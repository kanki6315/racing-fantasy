using System.Text.RegularExpressions;
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
                .Select(c => new ClassDto(c.Id, c.ChampionshipId, c.Name, c.Color)).ToListAsync()))
            .Produces<List<ClassDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.Classes.FindAsync(id) is { } c
                ? Results.Ok(new ClassDto(c.Id, c.ChampionshipId, c.Name, c.Color))
                : Results.NotFound())
            .Produces<ClassDto>();

        group.MapPost("/", async (CreateClass dto, FantasyDbContext db) =>
        {
            if (!await db.Championships.AnyAsync(c => c.Id == dto.ChampionshipId))
                return ApiResults.RefNotFound("championshipId");
            if (InvalidColor(dto.Color) is { } problem) return problem;

            var c = new Class { ChampionshipId = dto.ChampionshipId, Name = dto.Name, Color = dto.Color };
            db.Add(c);
            await db.SaveChangesAsync();
            return Results.Created($"/classes/{c.Id}", new ClassDto(c.Id, c.ChampionshipId, c.Name, c.Color));
        }).RequireAuthorization("Admin").Produces<ClassDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateClass dto, FantasyDbContext db) =>
        {
            if (InvalidColor(dto.Color) is { } problem) return problem;
            var c = await db.Classes.FindAsync(id);
            if (c is null) return Results.NotFound();
            c.Name = dto.Name;
            c.Color = dto.Color;
            await db.SaveChangesAsync();
            return Results.Ok(new ClassDto(c.Id, c.ChampionshipId, c.Name, c.Color));
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

    private static readonly Regex HexColor = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);

    /// <summary>Returns a 400 validation problem when a non-null color is not a #RRGGBB hex string; null when valid.</summary>
    private static IResult? InvalidColor(string? color) =>
        color is null || HexColor.IsMatch(color)
            ? null
            : Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["color"] = ["Color must be a #RRGGBB hex string."]
            });
}

public record ClassDto(long Id, long ChampionshipId, string Name, string? Color);
public record CreateClass(long ChampionshipId, string Name, string? Color);
public record UpdateClass(string Name, string? Color);
