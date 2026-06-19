using ImsaFantasy.Api.Common;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

public static class ClassEndpoints
{
    public static IEndpointRouteBuilder MapClassEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/classes").WithTags("Classes");   // reads are public; writes are gated per-endpoint below

        group.MapGet("/", async (long? championshipId, FantasyDbContext db) =>
            Results.Ok(await db.Classes
                .Where(c => championshipId == null || c.ChampionshipId == championshipId)
                .OrderBy(c => c.Name)
                .Select(c => new ClassDto(c.Id, c.ChampionshipId, c.Name)).ToListAsync()))
            .Produces<List<ClassDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.Classes.FindAsync(id) is { } c
                ? Results.Ok(new ClassDto(c.Id, c.ChampionshipId, c.Name))
                : Results.NotFound())
            .Produces<ClassDto>();

        group.MapPost("/", async (CreateClass dto, FantasyDbContext db) =>
        {
            if (!await db.Championships.AnyAsync(c => c.Id == dto.ChampionshipId))
                return ApiResults.RefNotFound("championshipId");

            var c = new Class { ChampionshipId = dto.ChampionshipId, Name = dto.Name };
            db.Add(c);
            await db.SaveChangesAsync();
            return Results.Created($"/classes/{c.Id}", new ClassDto(c.Id, c.ChampionshipId, c.Name));
        }).RequireAuthorization("Admin").Produces<ClassDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateClass dto, FantasyDbContext db) =>
        {
            var c = await db.Classes.FindAsync(id);
            if (c is null) return Results.NotFound();
            c.Name = dto.Name;
            await db.SaveChangesAsync();
            return Results.Ok(new ClassDto(c.Id, c.ChampionshipId, c.Name));
        }).RequireAuthorization("Admin").Produces<ClassDto>();

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var c = await db.Classes.FindAsync(id);
            if (c is null) return Results.NotFound();
            db.Remove(c);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization("Admin");

        return app;
    }
}

public record ClassDto(long Id, long ChampionshipId, string Name);
public record CreateClass(long ChampionshipId, string Name);
public record UpdateClass(string Name);
