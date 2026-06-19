using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Shared race weekends (ADR-0007). A championship opts into an event by attaching a round
/// (see <see cref="RoundEndpoints"/>). Reads are public — they back the cross-championship
/// calendar with no client-side dedup; writes are Admin.
/// </summary>
public static class EventEndpoints
{
    public static IEndpointRouteBuilder MapEventEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/events").WithTags("Events");   // reads public; writes gated below

        group.MapGet("/", async (FantasyDbContext db) =>
            Results.Ok(await WithRounds(db.Events)
                .OrderBy(e => e.StartsAt == null).ThenBy(e => e.StartsAt).ThenBy(e => e.Name)
                .AsNoTracking().Select(e => Map(e)).ToListAsync()))
            .Produces<List<EventDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await WithRounds(db.Events).AsNoTracking().FirstOrDefaultAsync(e => e.Id == id) is { } e
                ? Results.Ok(Map(e)) : Results.NotFound())
            .Produces<EventDto>();

        group.MapPost("/", async (CreateEvent dto, FantasyDbContext db) =>
        {
            var e = new Event
            {
                Name = dto.Name,
                Circuit = dto.Circuit,
                StartsAt = dto.StartsAt?.UtcDateTime,
                EndsAt = dto.EndsAt?.UtcDateTime
            };
            db.Add(e);
            await db.SaveChangesAsync();
            // Re-query so the (empty) round list is projected consistently with the read endpoints.
            var created = await WithRounds(db.Events).AsNoTracking().FirstAsync(x => x.Id == e.Id);
            return Results.Created($"/events/{e.Id}", Map(created));
        }).RequireAuthorization("Admin").Produces<EventDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateEvent dto, FantasyDbContext db) =>
        {
            var e = await db.Events.FindAsync(id);
            if (e is null) return Results.NotFound();
            e.Name = dto.Name;
            e.Circuit = dto.Circuit;
            e.StartsAt = dto.StartsAt?.UtcDateTime;
            e.EndsAt = dto.EndsAt?.UtcDateTime;
            await db.SaveChangesAsync();
            var updated = await WithRounds(db.Events).AsNoTracking().FirstAsync(x => x.Id == e.Id);
            return Results.Ok(Map(updated));
        }).RequireAuthorization("Admin").Produces<EventDto>();

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var e = await db.Events.FindAsync(id);
            if (e is null) return Results.NotFound();
            // Don't orphan opted-in rounds — detach them first (see /rounds PUT eventId=null).
            if (await db.Rounds.AnyAsync(r => r.EventId == id))
                return Results.Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Event has rounds",
                    detail: "Detach all rounds from this event before deleting it.");
            db.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization("Admin");

        return app;
    }

    // Eager-load the opted-in rounds and the season/championship each Map needs (round counts per
    // event are tiny — admin-scale). Without this the client-side Map sees an empty Rounds collection.
    private static IQueryable<Event> WithRounds(IQueryable<Event> q) => q
        .Include(e => e.Rounds).ThenInclude(r => r.Season).ThenInclude(s => s.Championship);

    private static EventDto Map(Event e) => new(
        e.Id, e.Name, e.Circuit,
        e.StartsAt is { } s ? new DateTimeOffset(s, TimeSpan.Zero) : null,
        e.EndsAt is { } x ? new DateTimeOffset(x, TimeSpan.Zero) : null,
        e.Rounds.OrderBy(r => r.QualiStart).Select(r => new EventRoundDto(
            r.Id, r.SeasonId, r.Season.ChampionshipId, r.Season.Championship.Name,
            r.Season.Year, r.Name, new DateTimeOffset(r.QualiStart, TimeSpan.Zero))).ToList());
}

public record EventDto(
    long Id, string Name, string? Circuit,
    DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, List<EventRoundDto> Rounds);

/// <summary>A championship's participation in an event — the round it opted in with.</summary>
public record EventRoundDto(
    long RoundId, long SeasonId, long ChampionshipId, string ChampionshipName,
    int Year, string RoundName, DateTimeOffset QualiStart);

public record CreateEvent(string Name, string? Circuit, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt);
public record UpdateEvent(string Name, string? Circuit, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt);
