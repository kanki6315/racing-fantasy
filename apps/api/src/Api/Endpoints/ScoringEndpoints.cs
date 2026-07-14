using ImsaFantasy.Api.Scoring;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Trigger scoring for a round and read the per-pick breakdown. Scoring is idempotent and runs
/// whatever sources have data + an active ruleset, so the same endpoint serves both phases
/// (after qualifying, then again after the race). Eventually invoked off a results.published
/// event (ADR-0003); exposed manually here.
/// </summary>
public static class ScoringEndpoints
{
    public static IEndpointRouteBuilder MapScoringEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/rounds/{roundId:long}/score", async (long roundId, ScoringService scoring) =>
        {
            var result = await scoring.ScoreRoundAsync(roundId);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).WithTags("Scoring").RequireAuthorization("Admin").Produces<ScoreRoundResult>();

        app.MapGet("/rounds/{roundId:long}/scores", async (long roundId, FantasyDbContext db) =>
        {
            if (!await db.Rounds.AnyAsync(r => r.Id == roundId)) return Results.NotFound();

            var raceNumberBySession = await db.Sessions
                .Where(s => s.RoundId == roundId && s.Type == SessionType.Race)
                .ToDictionaryAsync(s => s.Id, s => s.RaceNumber);
            var raceCount = raceNumberBySession.Count == 0 ? 1 : raceNumberBySession.Values.Max();

            var rosters = await db.Rosters.Where(r => r.RoundId == roundId)
                .Include(r => r.Picks)
                .Include(r => r.Modifiers).ThenInclude(m => m.TargetPick)
                .ToListAsync();
            var pickIds = rosters.SelectMany(r => r.Picks).Select(p => p.Id).ToList();
            var modifierIds = rosters.SelectMany(r => r.Modifiers).Select(m => m.Id).ToList();
            var scores = await db.Scores.Where(s =>
                    (s.PickId != null && pickIds.Contains(s.PickId.Value)) ||
                    (s.RosterModifierId != null && modifierIds.Contains(s.RosterModifierId.Value)))
                .ToListAsync();
            var scoresByPick = scores.Where(s => s.PickId != null)
                .GroupBy(s => s.PickId!.Value).ToDictionary(g => g.Key, g => g.ToList());
            var scoresByModifier = scores.Where(s => s.RosterModifierId != null)
                .GroupBy(s => s.RosterModifierId!.Value).ToDictionary(g => g.Key, g => g.ToList());
            var totals = (await db.RoundTotals.Where(rt => rt.RoundId == roundId).ToListAsync())
                .ToDictionary(rt => rt.RegistrationId, rt => rt.Points);

            List<SourceScoreDto> MapScores(List<Score>? owned) =>
                SourceScoreDto.Order((owned ?? new List<Score>())
                    .Select(s => SourceScoreDto.From(s, raceNumberBySession)));

            var registrations = rosters.Select(r => new RegistrationScoreDto(
                r.RegistrationId,
                totals.GetValueOrDefault(r.RegistrationId, 0m),
                r.Picks.Select(p => new PickScoreDto(
                    p.Id, p.SlotType, p.EntityType, p.EntityId, p.ClassId,
                    MapScores(scoresByPick.GetValueOrDefault(p.Id))))
                    .ToList(),
                r.Modifiers.Select(m => new ModifierScoreDto(
                    m.Id, m.Kind,
                    m.TargetPick is { } tp ? new EntityRef(tp.EntityType.ToString(), tp.EntityId) : null,
                    MapScores(scoresByModifier.GetValueOrDefault(m.Id))))
                    .ToList()))
                .OrderByDescending(r => r.Total)
                .ToList();

            return Results.Ok(new ScoresResponse(roundId, registrations, raceCount));
        }).WithTags("Scoring").RequireAuthorization("Admin").Produces<ScoresResponse>();

        return app;
    }
}

/// <summary>RaceCount = highest race number among the round's race sessions (min 1), so clients
/// know whether to label race scores R1/R2 without inferring from sparse score data.</summary>
public record ScoresResponse(long RoundId, List<RegistrationScoreDto> Registrations, int RaceCount = 1);

/// <summary>One scored source line. <see cref="RaceNumber"/> is set for RacePosition rows on which
/// race earned it (null for qualifying/bonus rows).</summary>
public record SourceScoreDto(ScoringSource Source, decimal Points, int RuleVersion, int? RaceNumber = null)
{
    public static SourceScoreDto From(Score s, IReadOnlyDictionary<long, int> raceNumberBySession) => new(
        s.Source, s.Points, s.RuleVersion,
        s.SessionId is { } sid && raceNumberBySession.TryGetValue(sid, out var rn) ? rn : null);

    /// <summary>Stable chip order: Q → R1 → R2 → FL → B.</summary>
    public static List<SourceScoreDto> Order(IEnumerable<SourceScoreDto> scores) => scores
        .OrderBy(s => s.Source switch
        {
            ScoringSource.QualifyingPosition => 0,
            ScoringSource.RacePosition => 1,
            ScoringSource.RaceFastestLap => 2,
            _ => 3
        })
        .ThenBy(s => s.RaceNumber ?? 0)
        .ToList();
}
public record PickScoreDto(long PickId, SlotType SlotType, EntityType EntityType, long EntityId, long ClassId, List<SourceScoreDto> Scores);
public record ModifierScoreDto(long ModifierId, string Kind, EntityRef? Target, List<SourceScoreDto> Scores);
public record RegistrationScoreDto(long RegistrationId, decimal Total, List<PickScoreDto> Picks, List<ModifierScoreDto> Modifiers);
