using EnduranceFantasy.Api.Common;
using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Endpoints;

public static class SeasonEndpoints
{
    public static IEndpointRouteBuilder MapSeasonEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/seasons").WithTags("Seasons");   // reads are public; writes are gated per-endpoint below

        group.MapGet("/", async (long? championshipId, FantasyDbContext db) =>
            Results.Ok(await db.Seasons
                .Where(s => championshipId == null || s.ChampionshipId == championshipId)
                .OrderByDescending(s => s.Year)
                .Select(s => new SeasonDto(s.Id, s.ChampionshipId, s.Year)).ToListAsync()))
            .Produces<List<SeasonDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.Seasons.FindAsync(id) is { } s
                ? Results.Ok(new SeasonDto(s.Id, s.ChampionshipId, s.Year))
                : Results.NotFound())
            .Produces<SeasonDto>();

        group.MapPost("/", async (CreateSeason dto, FantasyDbContext db) =>
        {
            if (!await db.Championships.AnyAsync(c => c.Id == dto.ChampionshipId))
                return ApiResults.RefNotFound("championshipId");

            var s = new Season { ChampionshipId = dto.ChampionshipId, Year = dto.Year };
            db.Add(s);
            await db.SaveChangesAsync();
            return Results.Created($"/seasons/{s.Id}", new SeasonDto(s.Id, s.ChampionshipId, s.Year));
        }).RequireAuthorization("Admin").Produces<SeasonDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateSeason dto, FantasyDbContext db) =>
        {
            var s = await db.Seasons.FindAsync(id);
            if (s is null) return Results.NotFound();
            s.Year = dto.Year;
            await db.SaveChangesAsync();
            return Results.Ok(new SeasonDto(s.Id, s.ChampionshipId, s.Year));
        }).RequireAuthorization("Admin").Produces<SeasonDto>();

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var s = await db.Seasons.FindAsync(id);
            if (s is null) return Results.NotFound();
            db.Remove(s);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization("Admin");

        return app;
    }
}

public record SeasonDto(long Id, long ChampionshipId, int Year);
public record CreateSeason(long ChampionshipId, int Year);
public record UpdateSeason(int Year);
