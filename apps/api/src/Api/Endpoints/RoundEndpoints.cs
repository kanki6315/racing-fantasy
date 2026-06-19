using ImsaFantasy.Api.Common;
using ImsaFantasy.Api.Picks;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

public static class RoundEndpoints
{
    public static IEndpointRouteBuilder MapRoundEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/rounds").WithTags("Rounds");   // reads are public; writes are gated per-endpoint below

        group.MapGet("/", async (long? seasonId, FantasyDbContext db) =>
            Results.Ok(await db.Rounds
                .Where(r => seasonId == null || r.SeasonId == seasonId)
                .OrderBy(r => r.Sequence)
                .Select(r => Map(r)).ToListAsync()))
            .Produces<List<RoundDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.Rounds.FindAsync(id) is { } r ? Results.Ok(Map(r)) : Results.NotFound())
            .Produces<RoundDto>();

        // The resolved roster rules for this round (public, like the price board): cap + legal
        // composition. Drives the cap bar and the live composition pills; the same resolver backs
        // the roster PUT validation, so the pills never disagree with submit-time checks.
        group.MapGet("/{id:long}/roster-rules", async (long id, FantasyDbContext db) =>
        {
            var round = await db.Rounds.FindAsync(id);
            if (round is null) return Results.NotFound();
            var rules = await RosterRulesResolver.ResolveAsync(db, round);
            return Results.Ok(new RosterRulesResponse(
                round.Id,
                rules.SalaryCap,
                rules.Classes.Select(c => new RosterRuleClass(c.ClassId, c.Name, "Main", c.Min, c.Max)).ToList(),
                rules.Modifiers.Select(m => new RosterRuleModifier(m.Kind, m.MaxCount, m.AppliesTo)).ToList()));
        }).Produces<RosterRulesResponse>();

        group.MapPost("/", async (CreateRound dto, FantasyDbContext db) =>
        {
            if (!await db.Seasons.AnyAsync(s => s.Id == dto.SeasonId))
                return ApiResults.RefNotFound("seasonId");
            if (dto.EventId is { } eid && !await db.Events.AnyAsync(e => e.Id == eid))
                return ApiResults.RefNotFound("eventId");
            if (dto.SalaryCap <= 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["salaryCap"] = ["salaryCap must be greater than 0."] });

            var r = new Round
            {
                SeasonId = dto.SeasonId,
                EventId = dto.EventId,
                Name = dto.Name,
                Circuit = dto.Circuit,
                Sequence = dto.Sequence,
                QualiStart = dto.QualiStart.UtcDateTime,
                StartsAt = dto.StartsAt?.UtcDateTime,
                EndsAt = dto.EndsAt?.UtcDateTime,
                SalaryCap = dto.SalaryCap
            };
            db.Add(r);
            await db.SaveChangesAsync();
            return Results.Created($"/rounds/{r.Id}", Map(r));
        }).RequireAuthorization("Admin").Produces<RoundDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateRound dto, FantasyDbContext db) =>
        {
            var r = await db.Rounds.FindAsync(id);
            if (r is null) return Results.NotFound();
            if (dto.EventId is { } eid && !await db.Events.AnyAsync(e => e.Id == eid))
                return ApiResults.RefNotFound("eventId");
            if (dto.SalaryCap <= 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["salaryCap"] = ["salaryCap must be greater than 0."] });
            r.EventId = dto.EventId;   // null detaches from the event (ADR-0007)
            r.Name = dto.Name;
            r.Circuit = dto.Circuit;
            r.Sequence = dto.Sequence;
            r.QualiStart = dto.QualiStart.UtcDateTime;
            r.StartsAt = dto.StartsAt?.UtcDateTime;
            r.EndsAt = dto.EndsAt?.UtcDateTime;
            r.SalaryCap = dto.SalaryCap;
            await db.SaveChangesAsync();
            return Results.Ok(Map(r));
        }).RequireAuthorization("Admin").Produces<RoundDto>();

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var r = await db.Rounds.FindAsync(id);
            if (r is null) return Results.NotFound();
            db.Remove(r);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization("Admin");

        return app;
    }

    private static RoundDto Map(Round r) => new(
        r.Id, r.SeasonId, r.Name, r.Circuit, r.Sequence,
        new DateTimeOffset(r.QualiStart, TimeSpan.Zero),
        r.StartsAt is { } s ? new DateTimeOffset(s, TimeSpan.Zero) : null,
        r.EndsAt is { } e ? new DateTimeOffset(e, TimeSpan.Zero) : null,
        r.SalaryCap, r.EventId);
}

// EventId is additive (ADR-0007 D3): existing consumers (name/circuit/dates unchanged) ignore it;
// the admin round form reads it to show the current event attachment.
public record RoundDto(
    long Id, long SeasonId, string Name, string? Circuit, int Sequence,
    DateTimeOffset QualiStart, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, decimal SalaryCap,
    long? EventId);

public record CreateRound(
    long SeasonId, string Name, string? Circuit, int Sequence,
    DateTimeOffset QualiStart, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, decimal SalaryCap,
    long? EventId);

public record UpdateRound(
    string Name, string? Circuit, int Sequence,
    DateTimeOffset QualiStart, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, decimal SalaryCap,
    long? EventId);

public record RosterRulesResponse(long RoundId, decimal SalaryCap, List<RosterRuleClass> Classes, List<RosterRuleModifier> Modifiers);
public record RosterRuleClass(long ClassId, string? Name, string Slot, int Min, int Max);
public record RosterRuleModifier(string Kind, int MaxCount, string AppliesTo);
