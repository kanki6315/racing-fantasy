using ImsaFantasy.Api.Leaderboards;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// The season-wide ("Global") standings and a single round's leaderboard, aggregated from
/// round_total (ADR-0001 D9 / MVP note: Postgres-backed). Per-league boards live in LeagueEndpoints.
/// </summary>
public static class LeaderboardEndpoints
{
    public static IEndpointRouteBuilder MapLeaderboardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/seasons/{seasonId:long}/leaderboard", async (long seasonId, FantasyDbContext db) =>
        {
            if (!await db.Seasons.AnyAsync(s => s.Id == seasonId)) return Results.NotFound();

            // Ordered by season sequence so ComputeMovement can identify the latest scored round.
            var roundIds = await db.Rounds.Where(r => r.SeasonId == seasonId)
                .OrderBy(r => r.Sequence).Select(r => r.Id).ToListAsync();
            var totals = await db.RoundTotals.Where(rt => roundIds.Contains(rt.RoundId)).ToListAsync();
            var rows = totals
                .GroupBy(rt => rt.RegistrationId)
                .Select(g => new Standings.Row(g.Key, g.Sum(x => x.Points), g.Count()))
                .ToList();
            var movement = Standings.ComputeMovement(totals, roundIds);

            return Results.Ok(new SeasonLeaderboardResponse(
                seasonId, await Standings.RankAsync(db, rows, movement: movement)));
        }).WithTags("Leaderboards").Produces<SeasonLeaderboardResponse>();

        app.MapGet("/rounds/{roundId:long}/leaderboard", async (long roundId, FantasyDbContext db) =>
        {
            if (!await db.Rounds.AnyAsync(r => r.Id == roundId)) return Results.NotFound();

            var rows = (await db.RoundTotals.Where(rt => rt.RoundId == roundId).ToListAsync())
                .Select(rt => new Standings.Row(rt.RegistrationId, rt.Points, 1))
                .ToList();

            return Results.Ok(new RoundLeaderboardResponse(roundId, await Standings.RankAsync(db, rows)));
        }).WithTags("Leaderboards").Produces<RoundLeaderboardResponse>();

        return app;
    }
}

public record SeasonLeaderboardResponse(long SeasonId, List<LeaderboardEntry> Entries);
public record RoundLeaderboardResponse(long RoundId, List<LeaderboardEntry> Entries);
