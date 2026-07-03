using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Scoring;

/// <summary>
/// The scoring engine (ADR-0003). Computes each pick's points from the active, versioned rulesets
/// for the three sources — MAIN: QualifyingPosition + RacePosition (class-relative car positions);
/// IMPACT: RaceFastestLap (rank of the driver's fastest lap within class). Idempotent: re-running
/// recomputes from current results, overwriting Score rows keyed (pick, source) and writing a
/// ScoreAudit row whenever a value changes. Two-phase falls out naturally — run after quali to
/// score QualifyingPosition, run again after the race to add RacePosition + RaceFastestLap.
/// </summary>
public sealed class ScoringService(FantasyDbContext db)
{
    public async Task<ScoreRoundResult?> ScoreRoundAsync(long roundId)
    {
        var round = await db.Rounds.FindAsync(roundId);
        if (round is null) return null;
        var now = DateTime.UtcNow;

        // Active rulesets by source, each as a rank -> points table.
        var rulesets = await db.ScoringRulesets
            .Where(r => r.SeasonId == round.SeasonId && r.Status == RulesetStatus.Active)
            .Include(r => r.PositionPoints)
            .ToListAsync();
        var bySource = rulesets.ToDictionary(
            r => r.Source,
            r => (r.Version, Points: r.PositionPoints.ToDictionary(p => p.Rank, p => p.Points)));

        decimal PointsFor(ScoringSource src, int rank) =>
            bySource.TryGetValue(src, out var rs) && rs.Points.TryGetValue(rank, out var pts) ? pts : 0m;

        // Results lookups for this round.
        var qualiSessions = await db.Sessions.Where(s => s.RoundId == roundId && s.Type == SessionType.Qualifying)
            .Select(s => s.Id).ToListAsync();
        var raceSessions = await db.Sessions.Where(s => s.RoundId == roundId && s.Type == SessionType.Race)
            .Select(s => s.Id).ToListAsync();

        var qualiPos = (await db.QualiResults.Where(q => qualiSessions.Contains(q.SessionId)).ToListAsync())
            .ToDictionary(q => (q.ClassId, q.CarEntryId), q => q.Position);
        var racePos = (await db.RaceResults.Where(q => raceSessions.Contains(q.SessionId)).ToListAsync())
            .ToDictionary(q => (q.ClassId, q.CarEntryId), q => q.Position);

        // Driver -> car entry (for driver MAIN picks), scoped to season + class. Rows pinned to THIS
        // round (entry-list import) win over season-wide (round_id NULL) rows — TryAdd keeps the
        // first match, so ordering round rows first makes a mid-season car swap score against the
        // car the driver actually raced this weekend.
        var driverCar = new Dictionary<(long DriverId, long ClassId), long>();
        foreach (var x in await db.EntryDrivers
                     .Where(e => e.SeasonId == round.SeasonId && (e.RoundId == null || e.RoundId == roundId))
                     .Join(db.CarEntries, e => e.CarEntryId, c => c.Id,
                         (e, c) => new { e.RoundId, e.DriverId, c.ClassId, CarId = c.Id })
                     .OrderByDescending(x => x.RoundId != null)
                     .ToListAsync())
            driverCar.TryAdd((x.DriverId, x.ClassId), x.CarId);

        var rosters = await db.Rosters.Where(r => r.RoundId == roundId)
            .Include(r => r.Picks).Include(r => r.Modifiers).ToListAsync();
        var picks = rosters.SelectMany(r => r.Picks).ToList();
        var modifiers = rosters.SelectMany(r => r.Modifiers).ToList();
        var pickIds = picks.Select(p => p.Id).ToList();
        var modifierIds = modifiers.Select(m => m.Id).ToList();

        var existing = (await db.Scores.Where(s =>
                (s.PickId != null && pickIds.Contains(s.PickId.Value)) ||
                (s.RosterModifierId != null && modifierIds.Contains(s.RosterModifierId.Value)))
            .ToListAsync())
            .ToDictionary(s => (s.PickId, s.RosterModifierId, s.Source));

        // Phase 1: compute pick-owned (position) scores, holding them so modifiers can read the base.
        var pickComputed = picks
            .SelectMany(p => ComputePick(p).Select(x => (Pick: p, x.Source, x.Points)))
            .ToList();
        var basePointsByPick = pickComputed.GroupBy(x => x.Pick.Id).ToDictionary(
            g => g.Key,
            g => (Points: g.Sum(x => x.Points), Version: g.Max(x => bySource[x.Source].Version)));

        // Phase 2: modifier-owned BONUS rows, derived from the base via each kind's handler (ADR-0006 D7).
        var ctx = new RoundScoringContext(basePointsByPick);
        var modComputed = modifiers
            .Where(m => ModifierScorers.For(m.Kind) is not null)
            .SelectMany(m => ModifierScorers.For(m.Kind)!.Score(m, ctx).Select(b => (Modifier: m, b.Points, b.RuleVersion)))
            .ToList();

        int inserted = 0, updated = 0;

        // Idempotent upsert keyed by (owner, source); audits any changed value (ADR-0003 D8).
        void Upsert(long? pickId, long? modifierId, long rosterId, ScoringSource source, decimal points, int version)
        {
            if (existing.TryGetValue((pickId, modifierId, source), out var score))
            {
                if (score.Points != points)
                {
                    db.Add(new ScoreAudit
                    {
                        PickId = pickId, RosterModifierId = modifierId, Source = source,
                        OldPoints = score.Points, NewPoints = points, Reason = "recompute", ComputedAt = now
                    });
                    score.Points = points;
                    score.RuleVersion = version;
                    score.ComputedAt = now;
                    updated++;
                }
            }
            else
            {
                db.Add(new Score
                {
                    RosterId = rosterId, PickId = pickId, RosterModifierId = modifierId, Source = source,
                    Points = points, RuleVersion = version, ComputedAt = now
                });
                inserted++;
            }
        }

        foreach (var (pick, source, points) in pickComputed)
            Upsert(pick.Id, null, pick.RosterId, source, points, bySource[source].Version);
        foreach (var (modifier, points, version) in modComputed)
            Upsert(null, modifier.Id, modifier.RosterId, ScoringSource.Bonus, points, version);

        await db.SaveChangesAsync();

        // Recompute round_total per registration from all scores on this round (pick- and modifier-owned).
        var rosterToReg = rosters.ToDictionary(r => r.Id, r => r.RegistrationId);
        var pickToReg = picks.ToDictionary(p => p.Id, p => rosterToReg[p.RosterId]);
        var modifierToReg = modifiers.ToDictionary(m => m.Id, m => rosterToReg[m.RosterId]);
        var allScores = await db.Scores.Where(s =>
                (s.PickId != null && pickIds.Contains(s.PickId.Value)) ||
                (s.RosterModifierId != null && modifierIds.Contains(s.RosterModifierId.Value)))
            .ToListAsync();
        var totals = allScores
            .GroupBy(s => s.PickId is { } pid ? pickToReg[pid] : modifierToReg[s.RosterModifierId!.Value])
            .ToDictionary(g => g.Key, g => g.Sum(s => s.Points));

        var existingTotals = (await db.RoundTotals.Where(rt => rt.RoundId == roundId).ToListAsync())
            .ToDictionary(rt => rt.RegistrationId);
        foreach (var (registrationId, points) in totals)
        {
            if (existingTotals.TryGetValue(registrationId, out var rt))
            {
                rt.Points = points;
                rt.UpdatedAt = now;
            }
            else
            {
                db.Add(new RoundTotal { RegistrationId = registrationId, RoundId = roundId, Points = points, UpdatedAt = now });
            }
        }
        await db.SaveChangesAsync();

        return new ScoreRoundResult(
            roundId,
            bySource.Keys.Select(s => s.ToString()).OrderBy(s => s).ToArray(),
            inserted, updated,
            totals.Select(t => new RegistrationTotal(t.Key, t.Value)).OrderByDescending(t => t.Points).ToList());

        // Local: which (source, points) a MAIN pick earns. IMPACT/RaceFastestLap is retired (ADR-0006);
        // bonuses now come from modifier handlers, not picks.
        IEnumerable<(ScoringSource Source, decimal Points)> ComputePick(Pick pick)
        {
            if (pick.SlotType != SlotType.Main) yield break;

            long? carId = pick.EntityType == EntityType.Car
                ? pick.EntityId
                : driverCar.TryGetValue((pick.EntityId, pick.ClassId), out var c) ? c : null;
            if (carId is not { } car) yield break;

            if (bySource.ContainsKey(ScoringSource.QualifyingPosition)
                && qualiPos.TryGetValue((pick.ClassId, car), out var qp))
                yield return (ScoringSource.QualifyingPosition, PointsFor(ScoringSource.QualifyingPosition, qp));

            if (bySource.ContainsKey(ScoringSource.RacePosition)
                && racePos.TryGetValue((pick.ClassId, car), out var rp))
                yield return (ScoringSource.RacePosition, PointsFor(ScoringSource.RacePosition, rp));
        }
    }
}

public sealed record ScoreRoundResult(long RoundId, string[] ActiveSources, int ScoresInserted, int ScoresUpdated, List<RegistrationTotal> Totals);
public sealed record RegistrationTotal(long RegistrationId, decimal Points);
