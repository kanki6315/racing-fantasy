using EnduranceFantasy.Api.Common;
using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Endpoints;

/// <summary>Lineup management — which drivers share a car entry (handles endurance co-drivers).</summary>
public static class EntryDriverEndpoints
{
    public static IEndpointRouteBuilder MapEntryDriverEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/entry-drivers").WithTags("Lineups").RequireAuthorization("Admin");

        group.MapGet("/", async (long? carEntryId, long? driverId, FantasyDbContext db) =>
            Results.Ok(await db.EntryDrivers
                .Where(x => (carEntryId == null || x.CarEntryId == carEntryId)
                            && (driverId == null || x.DriverId == driverId))
                .Select(x => new EntryDriverDto(x.Id, x.CarEntryId, x.DriverId, x.SeasonId,
                    x.RoundId, x.Rating, x.SlotOrder, x.IsRookie, x.IsCoach))
                .ToListAsync())).Produces<List<EntryDriverDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.EntryDrivers.FindAsync(id) is { } x
                ? Results.Ok(new EntryDriverDto(x.Id, x.CarEntryId, x.DriverId, x.SeasonId,
                    x.RoundId, x.Rating, x.SlotOrder, x.IsRookie, x.IsCoach))
                : Results.NotFound());

        // Season is derived from the car entry, so the lineup row can't drift to the wrong season.
        // Manual rows are season-wide (round_id NULL) unless a round is given; the round must belong
        // to the car's season for the same reason.
        group.MapPost("/", async (CreateEntryDriver dto, FantasyDbContext db) =>
        {
            var carEntry = await db.CarEntries.FindAsync(dto.CarEntryId);
            if (carEntry is null) return ApiResults.RefNotFound("carEntryId");
            if (!await db.Drivers.AnyAsync(d => d.Id == dto.DriverId))
                return ApiResults.RefNotFound("driverId");
            if (dto.RoundId is { } rid
                && !await db.Rounds.AnyAsync(r => r.Id == rid && r.SeasonId == carEntry.SeasonId))
                return ApiResults.RefNotFound("roundId");

            var x = new EntryDriver
            {
                CarEntryId = dto.CarEntryId,
                DriverId = dto.DriverId,
                SeasonId = carEntry.SeasonId,
                RoundId = dto.RoundId
            };
            db.Add(x);
            await db.SaveChangesAsync();
            return Results.Created($"/entry-drivers/{x.Id}",
                new EntryDriverDto(x.Id, x.CarEntryId, x.DriverId, x.SeasonId,
                    x.RoundId, x.Rating, x.SlotOrder, x.IsRookie, x.IsCoach));
        }).Produces<EntryDriverDto>(StatusCodes.Status201Created);

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var x = await db.EntryDrivers.FindAsync(id);
            if (x is null) return Results.NotFound();
            db.Remove(x);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return app;
    }
}

public record EntryDriverDto(
    long Id, long CarEntryId, long DriverId, long SeasonId,
    long? RoundId, DriverRating? Rating, int? SlotOrder, bool IsRookie, bool IsCoach);
public record CreateEntryDriver(long CarEntryId, long DriverId, long? RoundId = null);
