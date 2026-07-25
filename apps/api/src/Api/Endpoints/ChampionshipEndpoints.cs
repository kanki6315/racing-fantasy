using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Endpoints;

public static class ChampionshipEndpoints
{
    public static IEndpointRouteBuilder MapChampionshipEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/championships").WithTags("Championships");   // reads are public; writes are gated per-endpoint below

        group.MapGet("/", async (FantasyDbContext db) =>
            Results.Ok(await db.Championships.OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
                .Select(c => new ChampionshipDto(c.Id, c.Name, c.Slug, c.SortOrder)).ToListAsync()))
            .Produces<List<ChampionshipDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.Championships.FindAsync(id) is { } c
                ? Results.Ok(new ChampionshipDto(c.Id, c.Name, c.Slug, c.SortOrder))
                : Results.NotFound())
            .Produces<ChampionshipDto>();

        group.MapPost("/", async (CreateChampionship dto, FantasyDbContext db) =>
        {
            var c = new Championship { Name = dto.Name, Slug = dto.Slug, SortOrder = dto.Order };
            db.Add(c);
            await db.SaveChangesAsync();
            return Results.Created($"/championships/{c.Id}", new ChampionshipDto(c.Id, c.Name, c.Slug, c.SortOrder));
        }).RequireAuthorization("Admin").Produces<ChampionshipDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateChampionship dto, FantasyDbContext db) =>
        {
            var c = await db.Championships.FindAsync(id);
            if (c is null) return Results.NotFound();
            c.Name = dto.Name;
            c.Slug = dto.Slug;
            c.SortOrder = dto.Order;
            await db.SaveChangesAsync();
            return Results.Ok(new ChampionshipDto(c.Id, c.Name, c.Slug, c.SortOrder));
        }).RequireAuthorization("Admin").Produces<ChampionshipDto>();

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var c = await db.Championships.FindAsync(id);
            if (c is null) return Results.NotFound();
            db.Remove(c);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization("Admin");

        return app;
    }
}

public record ChampionshipDto(long Id, string Name, string Slug, int Order);
public record CreateChampionship(string Name, string Slug, int Order);
public record UpdateChampionship(string Name, string Slug, int Order);
