using ImsaFantasy.Api.Common;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>Roster composition rules per season/class/slot. A null classId bounds IMPACT picks across all classes.</summary>
public static class RosterRuleEndpoints
{
    public static IEndpointRouteBuilder MapRosterRuleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/roster-rules").WithTags("RosterRules").RequireAuthorization("Admin");

        group.MapGet("/", async (long? seasonId, FantasyDbContext db) =>
            Results.Ok(await db.RosterRules
                .Where(r => seasonId == null || r.SeasonId == seasonId)
                .OrderBy(r => r.ClassId).ThenBy(r => r.SlotType)
                .Select(r => new RosterRuleDto(r.Id, r.SeasonId, r.ClassId, r.SlotType, r.MinPicks, r.MaxPicks))
                .ToListAsync()));

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.RosterRules.FindAsync(id) is { } r
                ? Results.Ok(new RosterRuleDto(r.Id, r.SeasonId, r.ClassId, r.SlotType, r.MinPicks, r.MaxPicks))
                : Results.NotFound());

        group.MapPost("/", async (CreateRosterRule dto, FantasyDbContext db) =>
        {
            if (!await db.Seasons.AnyAsync(s => s.Id == dto.SeasonId))
                return ApiResults.RefNotFound("seasonId");
            if (dto.ClassId is { } classId && !await db.Classes.AnyAsync(c => c.Id == classId))
                return ApiResults.RefNotFound("classId");
            if (dto.MinPicks < 0 || dto.MaxPicks < dto.MinPicks)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["maxPicks"] = ["maxPicks must be >= minPicks and minPicks must be >= 0."]
                });

            var r = new RosterRule
            {
                SeasonId = dto.SeasonId,
                ClassId = dto.ClassId,
                SlotType = dto.SlotType,
                MinPicks = dto.MinPicks,
                MaxPicks = dto.MaxPicks
            };
            db.Add(r);
            await db.SaveChangesAsync();
            return Results.Created($"/roster-rules/{r.Id}",
                new RosterRuleDto(r.Id, r.SeasonId, r.ClassId, r.SlotType, r.MinPicks, r.MaxPicks));
        });

        group.MapPut("/{id:long}", async (long id, UpdateRosterRule dto, FantasyDbContext db) =>
        {
            var r = await db.RosterRules.FindAsync(id);
            if (r is null) return Results.NotFound();
            if (dto.MinPicks < 0 || dto.MaxPicks < dto.MinPicks)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["maxPicks"] = ["maxPicks must be >= minPicks and minPicks must be >= 0."]
                });
            r.MinPicks = dto.MinPicks;
            r.MaxPicks = dto.MaxPicks;
            await db.SaveChangesAsync();
            return Results.Ok(new RosterRuleDto(r.Id, r.SeasonId, r.ClassId, r.SlotType, r.MinPicks, r.MaxPicks));
        });

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var r = await db.RosterRules.FindAsync(id);
            if (r is null) return Results.NotFound();
            db.Remove(r);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return app;
    }
}

public record RosterRuleDto(long Id, long SeasonId, long? ClassId, SlotType SlotType, int MinPicks, int MaxPicks);
public record CreateRosterRule(long SeasonId, long? ClassId, SlotType SlotType, int MinPicks, int MaxPicks);
public record UpdateRosterRule(int MinPicks, int MaxPicks);
