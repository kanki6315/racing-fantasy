using ImsaFantasy.Api.Common;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Admin CRUD for the modifiers a season offers (ADR-0006 D3): which kinds, how many of each per
/// round, and the target shape (<c>AppliesTo</c>). The resolver surfaces these to the pick page;
/// players select them on their roster (free, no salary).
/// </summary>
public static class RosterModifierRuleEndpoints
{
    private static readonly string[] KnownAppliesTo = ["MainPick", "Driver", "Manufacturer", "None"];

    public static IEndpointRouteBuilder MapRosterModifierRuleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/roster-modifier-rules").WithTags("RosterModifierRules").RequireAuthorization("Admin");

        group.MapGet("/", async (long? seasonId, FantasyDbContext db) =>
            Results.Ok(await db.RosterModifierRules
                .Where(r => seasonId == null || r.SeasonId == seasonId)
                .OrderBy(r => r.Kind)
                .Select(r => new RosterModifierRuleDto(r.Id, r.SeasonId, r.Kind, r.MaxCount, r.AppliesTo))
                .ToListAsync()))
            .Produces<List<RosterModifierRuleDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.RosterModifierRules.FindAsync(id) is { } r
                ? Results.Ok(new RosterModifierRuleDto(r.Id, r.SeasonId, r.Kind, r.MaxCount, r.AppliesTo))
                : Results.NotFound())
            .Produces<RosterModifierRuleDto>();

        group.MapPost("/", async (CreateRosterModifierRule dto, FantasyDbContext db) =>
        {
            if (!await db.Seasons.AnyAsync(s => s.Id == dto.SeasonId))
                return ApiResults.RefNotFound("seasonId");
            if (Validate(dto.Kind, dto.MaxCount, dto.AppliesTo) is { } problem)
                return problem;

            var r = new RosterModifierRule
            {
                SeasonId = dto.SeasonId,
                Kind = dto.Kind.Trim(),
                MaxCount = dto.MaxCount,
                AppliesTo = dto.AppliesTo
            };
            db.Add(r);
            await db.SaveChangesAsync();
            return Results.Created($"/roster-modifier-rules/{r.Id}",
                new RosterModifierRuleDto(r.Id, r.SeasonId, r.Kind, r.MaxCount, r.AppliesTo));
        }).Produces<RosterModifierRuleDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateRosterModifierRule dto, FantasyDbContext db) =>
        {
            var r = await db.RosterModifierRules.FindAsync(id);
            if (r is null) return Results.NotFound();
            if (Validate(r.Kind, dto.MaxCount, dto.AppliesTo) is { } problem)
                return problem;
            r.MaxCount = dto.MaxCount;
            r.AppliesTo = dto.AppliesTo;
            await db.SaveChangesAsync();
            return Results.Ok(new RosterModifierRuleDto(r.Id, r.SeasonId, r.Kind, r.MaxCount, r.AppliesTo));
        }).Produces<RosterModifierRuleDto>();

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var r = await db.RosterModifierRules.FindAsync(id);
            if (r is null) return Results.NotFound();
            db.Remove(r);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return app;

        IResult? Validate(string kind, int maxCount, string appliesTo)
        {
            if (string.IsNullOrWhiteSpace(kind))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["kind"] = ["kind is required."] });
            if (maxCount < 1)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["maxCount"] = ["maxCount must be >= 1."] });
            if (!KnownAppliesTo.Contains(appliesTo))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["appliesTo"] = [$"appliesTo must be one of: {string.Join(", ", KnownAppliesTo)}."]
                });
            return null;
        }
    }
}

public record RosterModifierRuleDto(long Id, long SeasonId, string Kind, int MaxCount, string AppliesTo);
public record CreateRosterModifierRule(long SeasonId, string Kind, int MaxCount, string AppliesTo);
public record UpdateRosterModifierRule(int MaxCount, string AppliesTo);
