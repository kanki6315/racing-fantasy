using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace EnduranceFantasy.Api.Endpoints;

/// <summary>
/// Per-round prices for pickable entities. Prices change every round (ADR-0001 D2). The read is
/// served from an in-process cache for the pre-lock spike (Redis deferred — data-model MVP note).
/// </summary>
public static class PriceEndpoints
{
    public static string CacheKey(long roundId) => $"prices:{roundId}";

    public static IEndpointRouteBuilder MapPriceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/rounds/{roundId:long}/prices").WithTags("Prices");

        group.MapGet("/", async (long roundId, FantasyDbContext db, IMemoryCache cache) =>
        {
            if (!await db.Rounds.AnyAsync(r => r.Id == roundId)) return Results.NotFound();

            var items = await cache.GetOrCreateAsync(CacheKey(roundId), async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
                return await LoadPrices(db, roundId);
            });
            return Results.Ok(items);
        }).Produces<List<PriceItem>>();

        // Bulk upsert — prices are re-set every round, so the admin/import flow sends the whole
        // board. A null price DELETES the entity's price row (withdrawal/scratch, ADR-0012): the
        // entity leaves the pick board, and any roster still holding it fails its next pre-lock
        // PUT with 422 unavailable — forcing the player to swap the withdrawn entry out.
        group.MapPost("/", async (long roundId, PriceUpsertRequest req, FantasyDbContext db, IMemoryCache cache) =>
        {
            if (!await db.Rounds.AnyAsync(r => r.Id == roundId)) return Results.NotFound();
            if (req.Prices is null || req.Prices.Count == 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["prices"] = ["At least one price is required."] });

            var carIds = req.Prices.Where(p => p.EntityType == EntityType.Car).Select(p => p.EntityId).Distinct().ToList();
            var drvIds = req.Prices.Where(p => p.EntityType == EntityType.Driver).Select(p => p.EntityId).Distinct().ToList();
            var existCars = (await db.CarEntries.Where(c => carIds.Contains(c.Id)).Select(c => c.Id).ToListAsync()).ToHashSet();
            var existDrv = (await db.Drivers.Where(d => drvIds.Contains(d.Id)).Select(d => d.Id).ToListAsync()).ToHashSet();

            var errors = new List<object>();
            for (var i = 0; i < req.Prices.Count; i++)
            {
                var p = req.Prices[i];
                var ok = p.EntityType == EntityType.Car ? existCars.Contains(p.EntityId) : existDrv.Contains(p.EntityId);
                if (!ok) errors.Add(new { index = i, message = $"{p.EntityType} {p.EntityId} not found" });
                if (p.Price is < 0) errors.Add(new { index = i, message = "price must be >= 0" });
            }
            if (errors.Count > 0)
                return Results.Json(new { errors }, statusCode: StatusCodes.Status422UnprocessableEntity);

            var existing = await db.EntityPrices.Where(ep => ep.RoundId == roundId).ToListAsync();
            var byKey = existing.ToDictionary(ep => (ep.EntityType, ep.EntityId));
            int created = 0, updated = 0, deleted = 0;
            foreach (var p in req.Prices)
            {
                var found = byKey.TryGetValue((p.EntityType, p.EntityId), out var ep);
                if (p.Price is not { } price)
                {
                    if (found)
                    {
                        db.Remove(ep!);
                        byKey.Remove((p.EntityType, p.EntityId));
                        deleted++;
                    }
                    continue; // deleting an absent price is a no-op, not an error (idempotent)
                }
                if (found)
                {
                    ep!.Price = price;
                    ep.ClassId = p.ClassId;
                    updated++;
                }
                else
                {
                    var row = new EntityPrice
                    {
                        RoundId = roundId, EntityType = p.EntityType, EntityId = p.EntityId,
                        ClassId = p.ClassId, Price = price
                    };
                    db.Add(row);
                    byKey[(p.EntityType, p.EntityId)] = row;
                    created++;
                }
            }

            await db.SaveChangesAsync();
            cache.Remove(CacheKey(roundId));
            return Results.Ok(new PriceUpsertResponse(roundId, created, updated, deleted));
        }).RequireAuthorization("Admin").Produces<PriceUpsertResponse>();   // GET stays public (the selection board); writes are admin.

        return app;
    }

    private static async Task<List<PriceItem>> LoadPrices(FantasyDbContext db, long roundId)
    {
        var prices = await db.EntityPrices.Where(p => p.RoundId == roundId).ToListAsync();
        var carIds = prices.Where(p => p.EntityType == EntityType.Car).Select(p => p.EntityId).ToList();
        var drvIds = prices.Where(p => p.EntityType == EntityType.Driver).Select(p => p.EntityId).ToList();
        var cars = await db.CarEntries.Where(c => carIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
        var drivers = await db.Drivers.Where(d => drvIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id);

        // Each car's driver lineup so the pick board can show who drives a team. A car's rows for
        // THIS round (entry-list import) replace its season-wide (round_id NULL) rows, so weekends
        // with an imported entry list show the actual lineup, not the season union. Listed order
        // when the import supplied it (slot_order), insertion id otherwise.
        var lineup = (await db.EntryDrivers
                .Where(ed => carIds.Contains(ed.CarEntryId) && (ed.RoundId == null || ed.RoundId == roundId))
                .Select(ed => new { ed.CarEntryId, ed.DriverId, ed.RoundId, ed.SlotOrder, ed.Id, ed.Driver.FullName })
                .ToListAsync())
            .GroupBy(x => x.CarEntryId)
            .ToDictionary(
                g => g.Key,
                g => (g.Any(x => x.RoundId != null) ? g.Where(x => x.RoundId != null) : g)
                    .OrderBy(x => x.SlotOrder ?? int.MaxValue).ThenBy(x => x.Id)
                    .Select(x => new DriverLite(x.DriverId, x.FullName)).ToList());

        return prices.Select(p =>
        {
            string? display = null, number = null;
            if (p.EntityType == EntityType.Car && cars.TryGetValue(p.EntityId, out var c))
                (display, number) = ($"#{c.Number} {c.TeamName}", c.Number);
            else if (p.EntityType == EntityType.Driver && drivers.TryGetValue(p.EntityId, out var d))
                display = d.FullName;
            var dl = p.EntityType == EntityType.Car && lineup.TryGetValue(p.EntityId, out var l) ? l : null;
            return new PriceItem(p.EntityType, p.EntityId, p.ClassId, p.Price, display, dl, number);
        })
            .OrderBy(i => i.ClassId).ThenByDescending(i => i.Price).ToList();
    }
}

public record PriceUpsertRequest(List<PriceInput> Prices);
/// <summary>A null <see cref="Price"/> deletes the entity's price row for the round (withdrawal).</summary>
public record PriceInput(EntityType EntityType, long EntityId, long ClassId, decimal? Price);
public record PriceItem(EntityType EntityType, long EntityId, long ClassId, decimal Price, string? DisplayName, List<DriverLite>? Drivers = null, string? Number = null);
public record DriverLite(long Id, string FullName);
public record PriceUpsertResponse(long RoundId, int Created, int Updated, int Deleted = 0);
