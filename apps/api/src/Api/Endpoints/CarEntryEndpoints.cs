using ImsaFantasy.Api.Common;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

public static class CarEntryEndpoints
{
    public static IEndpointRouteBuilder MapCarEntryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/car-entries").WithTags("CarEntries").RequireAuthorization("Admin");

        group.MapGet("/", async (long? seasonId, long? classId, FantasyDbContext db) =>
            Results.Ok(await db.CarEntries
                .Where(e => (seasonId == null || e.SeasonId == seasonId)
                            && (classId == null || e.ClassId == classId))
                .OrderBy(e => e.Number)
                .Select(e => new CarEntryDto(e.Id, e.SeasonId, e.ClassId, e.Number, e.TeamName, e.CarModel, e.BronzeCup))
                .ToListAsync())).Produces<List<CarEntryDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.CarEntries.FindAsync(id) is { } e
                ? Results.Ok(new CarEntryDto(e.Id, e.SeasonId, e.ClassId, e.Number, e.TeamName, e.CarModel, e.BronzeCup))
                : Results.NotFound());

        group.MapPost("/", async (CreateCarEntry dto, FantasyDbContext db) =>
        {
            if (!await db.Seasons.AnyAsync(s => s.Id == dto.SeasonId))
                return ApiResults.RefNotFound("seasonId");
            if (!await db.Classes.AnyAsync(c => c.Id == dto.ClassId))
                return ApiResults.RefNotFound("classId");

            var e = new CarEntry
            {
                SeasonId = dto.SeasonId,
                ClassId = dto.ClassId,
                Number = dto.Number,
                TeamName = dto.TeamName,
                CarModel = dto.CarModel,
                BronzeCup = dto.BronzeCup ?? false
            };
            db.Add(e);
            await db.SaveChangesAsync();
            return Results.Created($"/car-entries/{e.Id}",
                new CarEntryDto(e.Id, e.SeasonId, e.ClassId, e.Number, e.TeamName, e.CarModel, e.BronzeCup));
        }).Produces<CarEntryDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateCarEntry dto, FantasyDbContext db) =>
        {
            var e = await db.CarEntries.FindAsync(id);
            if (e is null) return Results.NotFound();
            e.Number = dto.Number;
            e.TeamName = dto.TeamName;
            e.CarModel = dto.CarModel;
            e.BronzeCup = dto.BronzeCup ?? false;
            await db.SaveChangesAsync();
            return Results.Ok(new CarEntryDto(e.Id, e.SeasonId, e.ClassId, e.Number, e.TeamName, e.CarModel, e.BronzeCup));
        }).Produces<CarEntryDto>();

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var e = await db.CarEntries.FindAsync(id);
            if (e is null) return Results.NotFound();
            db.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return app;
    }
}

public record CarEntryDto(long Id, long SeasonId, long ClassId, string Number, string TeamName, string? CarModel, bool BronzeCup);
public record CreateCarEntry(long SeasonId, long ClassId, string Number, string TeamName, string? CarModel = null, bool? BronzeCup = null);
public record UpdateCarEntry(string Number, string TeamName, string? CarModel = null, bool? BronzeCup = null);
