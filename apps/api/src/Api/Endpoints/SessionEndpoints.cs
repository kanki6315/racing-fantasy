using EnduranceFantasy.Api.Common;
using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Endpoints;

public static class SessionEndpoints
{
    public static IEndpointRouteBuilder MapSessionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/sessions").WithTags("Sessions").RequireAuthorization("Admin");

        group.MapGet("/", async (long? roundId, FantasyDbContext db) =>
            Results.Ok(await db.Sessions
                .Where(s => roundId == null || s.RoundId == roundId)
                .OrderBy(s => s.ClassId).ThenBy(s => s.Type).ThenBy(s => s.RaceNumber)
                .Select(s => Map(s)).ToListAsync())).Produces<List<SessionDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.Sessions.FindAsync(id) is { } s ? Results.Ok(Map(s)) : Results.NotFound());

        group.MapPost("/", async (CreateSession dto, FantasyDbContext db) =>
        {
            if (!await db.Rounds.AnyAsync(r => r.Id == dto.RoundId))
                return ApiResults.RefNotFound("roundId");
            if (!await db.Classes.AnyAsync(c => c.Id == dto.ClassId))
                return ApiResults.RefNotFound("classId");
            if (ValidateRaceNumber(dto.Type, dto.RaceNumber ?? 1) is { } problem)
                return problem;

            var s = new Session
            {
                RoundId = dto.RoundId,
                ClassId = dto.ClassId,
                Type = dto.Type,
                RaceNumber = dto.RaceNumber ?? 1,
                ScheduledStart = dto.ScheduledStart?.UtcDateTime,
                Status = dto.Status ?? SessionStatus.Scheduled
            };
            db.Add(s);
            await db.SaveChangesAsync();
            return Results.Created($"/sessions/{s.Id}", Map(s));
        }).Produces<SessionDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateSession dto, FantasyDbContext db) =>
        {
            var s = await db.Sessions.FindAsync(id);
            if (s is null) return Results.NotFound();
            if (ValidateRaceNumber(dto.Type, dto.RaceNumber ?? 1) is { } problem)
                return problem;
            s.Type = dto.Type;
            s.RaceNumber = dto.RaceNumber ?? 1;
            s.ScheduledStart = dto.ScheduledStart?.UtcDateTime;
            s.ActualStart = dto.ActualStart?.UtcDateTime;
            s.Status = dto.Status;
            await db.SaveChangesAsync();
            return Results.Ok(Map(s));
        }).Produces<SessionDto>();

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var s = await db.Sessions.FindAsync(id);
            if (s is null) return Results.NotFound();
            db.Remove(s);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return app;
    }

    /// <summary>Multi-race guard: race numbers start at 1 and only Race sessions can have more
    /// than one — a duplicate quali would break the per-class ingestion lookups.</summary>
    private static IResult? ValidateRaceNumber(SessionType type, int raceNumber) => raceNumber switch
    {
        < 1 => Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["raceNumber"] = ["raceNumber must be >= 1."]
        }),
        > 1 when type != SessionType.Race => Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["raceNumber"] = ["Only Race sessions can have raceNumber > 1."]
        }),
        _ => null
    };

    private static SessionDto Map(Session s) => new(
        s.Id, s.RoundId, s.ClassId, s.Type, s.RaceNumber,
        s.ScheduledStart is { } sc ? new DateTimeOffset(sc, TimeSpan.Zero) : null,
        s.ActualStart is { } ac ? new DateTimeOffset(ac, TimeSpan.Zero) : null,
        s.Status);
}

public record SessionDto(
    long Id, long RoundId, long ClassId, SessionType Type, int RaceNumber,
    DateTimeOffset? ScheduledStart, DateTimeOffset? ActualStart, SessionStatus Status);

public record CreateSession(
    long RoundId, long ClassId, SessionType Type,
    DateTimeOffset? ScheduledStart, SessionStatus? Status, int? RaceNumber = 1);

public record UpdateSession(
    SessionType Type, DateTimeOffset? ScheduledStart, DateTimeOffset? ActualStart, SessionStatus Status,
    int? RaceNumber = 1);
