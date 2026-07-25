using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace EnduranceFantasy.Api.Endpoints;

/// <summary>
/// Public aggregate stats for the landing page (the "Players"/"Leagues" tiles). A player is a
/// distinct registered user across all seasons/championships (erased registrations have a null
/// UserId and are excluded — ADR-0004). Served from an in-process cache so the marketing tiles cost
/// one pair of COUNTs per TTL window regardless of traffic, not per request (Redis deferred — same
/// pattern as <see cref="PriceEndpoints"/>). The numbers are allowed to be slightly stale.
/// </summary>
public static class StatsEndpoints
{
    public const string CacheKey = "stats:global";

    public static IEndpointRouteBuilder MapStatsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/stats", async (FantasyDbContext db, IMemoryCache cache) =>
            Results.Ok(await cache.GetOrCreateAsync(CacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                var players = await db.Registrations
                    .Where(r => r.UserId != null)
                    .Select(r => r.UserId)
                    .Distinct()
                    .CountAsync();
                var leagues = await db.Leagues.CountAsync();
                return new GlobalStats(players, leagues);
            })))
            .WithTags("Stats")
            .Produces<GlobalStats>();   // public — no RequireAuthorization

        return app;
    }
}

public record GlobalStats(int Players, int Leagues);
