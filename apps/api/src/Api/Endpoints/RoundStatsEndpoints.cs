using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Public "Round Recap" aggregates for a single round — ownership %, the field's score context, the
/// best-value pick and the most-used bonus. Analytic, post-hoc figures (the brand's telemetry side,
/// not betting odds): the endpoint is <b>lock-gated</b> exactly like the opponent-picks drill-in
/// (<see cref="RosterEndpoints"/>) — it returns <c>409 not_locked</c> until <c>round.quali_start</c> so
/// pre-lock ownership can't leak the meta and let players copy the chalk. Served from the in-process
/// cache (5 min) like <see cref="StatsEndpoints"/>; the numbers may be slightly stale. All figures are
/// group-bys over existing pick/score/price/modifier rows — no schema additions.
/// </summary>
public static class RoundStatsEndpoints
{
    public static string CacheKey(long roundId) => $"round-stats:{roundId}";

    public static IEndpointRouteBuilder MapRoundStatsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rounds/{roundId:long}/stats", async (long roundId, FantasyDbContext db, IMemoryCache cache) =>
        {
            var round = await db.Rounds.FindAsync(roundId);
            if (round is null) return Results.NotFound();

            // Lock gate — same boundary as the picks drill-in: nothing about who picked what is revealed
            // until qualifying begins. The 409 is never cached (only the computed payload below is).
            if (DateTime.UtcNow < round.QualiStart)
                return Results.Json(
                    new RoundStatsError("not_locked", "Round stats are hidden until qualifying begins."),
                    statusCode: StatusCodes.Status409Conflict);

            var stats = await cache.GetOrCreateAsync(CacheKey(roundId), async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                return await Compute(db, roundId);
            });
            return Results.Ok(stats);
        })
        .WithTags("Stats")
        .Produces<RoundStatsResponse>()
        .Produces<RoundStatsError>(StatusCodes.Status409Conflict);   // public — no RequireAuthorization

        return app;
    }

    private static async Task<RoundStatsResponse> Compute(FantasyDbContext db, long roundId)
    {
        var rosterIds = await db.Rosters.Where(r => r.RoundId == roundId).Select(r => r.Id).ToListAsync();
        var rosters = rosterIds.Count;

        var picks = await db.Picks
            .Where(p => rosterIds.Contains(p.RosterId) && p.SlotType == SlotType.Main)
            .Select(p => new { p.Id, p.RosterId, p.EntityType, p.EntityId, p.ClassId })
            .ToListAsync();

        // Base position points per pick (quali + race). An entity's points are constant across the players
        // who own it (same grid/finish), so averaging per-pick sums collapses to that entity's points.
        var pickIds = picks.Select(p => p.Id).ToList();
        var baseScores = await db.Scores
            .Where(s => s.PickId != null && pickIds.Contains(s.PickId.Value)
                && (s.Source == ScoringSource.QualifyingPosition || s.Source == ScoringSource.RacePosition))
            .Select(s => new { PickId = s.PickId!.Value, s.Points })
            .ToListAsync();
        var pointsByPick = baseScores.GroupBy(s => s.PickId).ToDictionary(g => g.Key, g => g.Sum(x => x.Points));

        var prices = await db.EntityPrices.Where(ep => ep.RoundId == roundId)
            .ToDictionaryAsync(ep => (ep.EntityType, ep.EntityId), ep => ep.Price);

        var byEntity = picks.GroupBy(p => (p.EntityType, p.EntityId)).Select(g =>
        {
            var withPts = g.Where(x => pointsByPick.ContainsKey(x.Id)).Select(x => pointsByPick[x.Id]).ToList();
            return new EntityAgg(
                g.Key.EntityType, g.Key.EntityId, g.First().ClassId,
                PickCount: g.Select(x => x.RosterId).Distinct().Count(),
                Points: withPts.Count > 0 ? withPts.Average() : null,
                Price: prices.TryGetValue(g.Key, out var pr) ? pr : null);
        }).ToList();

        // Every bonus kind used this round, each with its most-targeted entity + average bonus points.
        // The client derives "top bonus" from this; the full list also drives a usage breakdown.
        var mods = await db.RosterModifiers.Where(m => rosterIds.Contains(m.RosterId))
            .Select(m => new { m.Id, m.Kind, m.TargetPickId }).ToListAsync();
        var pickEntity = picks.ToDictionary(p => p.Id, p => (p.EntityType, p.EntityId, p.ClassId));
        var bonusByMod = (await db.Scores
                .Where(s => s.RosterModifierId != null && s.Source == ScoringSource.Bonus
                    && rosterIds.Contains(s.RosterId))
                .Select(s => new { ModId = s.RosterModifierId!.Value, s.Points }).ToListAsync())
            .GroupBy(s => s.ModId).ToDictionary(g => g.Key, g => g.Sum(x => x.Points));

        var modAggs = mods.GroupBy(m => m.Kind).Select(g =>
        {
            var topTarget = g.Where(m => m.TargetPickId != null)
                .Select(m => pickEntity.TryGetValue(m.TargetPickId!.Value, out var e) ? ((EntityType, long, long)?)e : null)
                .Where(e => e != null).Select(e => e!.Value)
                .GroupBy(e => (e.Item1, e.Item2))
                .OrderByDescending(x => x.Count()).FirstOrDefault();
            var bonuses = g.Select(m => bonusByMod.TryGetValue(m.Id, out var b) ? (decimal?)b : null)
                .Where(b => b != null).Select(b => b!.Value).ToList();
            return new ModAgg(g.Key, g.Count(),
                topTarget is null ? null : (topTarget.Key.Item1, topTarget.Key.Item2),
                bonuses.Count > 0 ? Math.Round(bonuses.Average(), 1) : null);
        }).OrderByDescending(m => m.UsageCount).ToList();

        // Resolve display names once for every entity we surface — all picked entities + bonus targets.
        var refs = byEntity.Select(e => (e.EntityType, e.EntityId))
            .Concat(modAggs.Where(m => m.Target != null).Select(m => m.Target!.Value))
            .Distinct().ToList();
        var carIds = refs.Where(r => r.Item1 == EntityType.Car).Select(r => r.Item2).ToList();
        var drvIds = refs.Where(r => r.Item1 == EntityType.Driver).Select(r => r.Item2).ToList();
        var cars = await db.CarEntries.Where(c => carIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
        var drivers = await db.Drivers.Where(d => drvIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id);
        string? Name(EntityType t, long id) => t == EntityType.Car
            ? (cars.TryGetValue(id, out var c) ? $"#{c.Number} {c.TeamName}" : null)
            : (drivers.TryGetValue(id, out var d) ? d.FullName : null);

        // All picked entities (full per-entity stats), sorted by ownership; the client builds the
        // per-category top-10s and applies the class filter.
        var entities = byEntity
            .OrderByDescending(e => e.PickCount).ThenByDescending(e => e.Points ?? -1).ThenBy(e => e.EntityId)
            .Select(e => new EntityStat(
                e.EntityType, e.EntityId, e.ClassId, Name(e.EntityType, e.EntityId),
                e.PickCount, Pct(e.PickCount, rosters), e.Points, e.Price))
            .ToList();

        var modifiers = modAggs.Select(m => new ModifierStat(
            m.Kind, m.UsageCount, Pct(m.UsageCount, rosters),
            m.Target?.Item1, m.Target?.Item2,
            m.Target is null ? null : Name(m.Target.Value.Item1, m.Target.Value.Item2),
            m.AvgBonus)).ToList();

        var totals = await db.RoundTotals.Where(rt => rt.RoundId == roundId).Select(rt => rt.Points).ToListAsync();

        return new RoundStatsResponse(
            roundId, rosters,
            totals.Count > 0 ? totals.Max() : null,
            totals.Count > 0 ? Math.Round(totals.Average(), 1) : null,
            entities, modifiers);
    }

    private static decimal Pct(int n, int total) => total == 0 ? 0 : Math.Round((decimal)n * 100 / total, 1);

    /// <summary>Internal aggregates before display names are resolved.</summary>
    private sealed record EntityAgg(
        EntityType EntityType, long EntityId, long ClassId, int PickCount, decimal? Points, decimal? Price);
    private sealed record ModAgg(
        string Kind, int UsageCount, (EntityType, long)? Target, decimal? AvgBonus);
}

public record RoundStatsResponse(
    long RoundId, int Rosters, decimal? HighScore, decimal? AvgScore,
    List<EntityStat> Entities, List<ModifierStat> Modifiers);

public record EntityStat(
    EntityType EntityType, long EntityId, long ClassId, string? DisplayName,
    int PickCount, decimal PickPct, decimal? Points, decimal? Price);

public record ModifierStat(
    string Kind, int UsageCount, decimal UsagePct,
    EntityType? TopTargetEntityType, long? TopTargetEntityId, string? TopTargetName, decimal? AvgBonus);

public record RoundStatsError(string Error, string Message);
