using ImsaFantasy.Api.Auth;
using ImsaFantasy.Api.Common;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Per-season registration (per-championship opt-in). The signed-in user registers and provides a
/// public team name (ADR-0004) shown on leaderboards. The salary cap is per round (ADR-0001 D2),
/// set on the <see cref="Round"/> — not chosen here.
/// </summary>
public static class RegistrationEndpoints
{
    public static IEndpointRouteBuilder MapRegistrationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/registrations").WithTags("Registrations");

        group.MapGet("/", async (long? seasonId, long? userId, FantasyDbContext db) =>
            Results.Ok(await db.Registrations
                .Where(r => (seasonId == null || r.SeasonId == seasonId)
                            && (userId == null || r.UserId == userId))
                .Select(r => new RegistrationDto(r.Id, r.UserId, r.SeasonId, r.TeamName))
                .ToListAsync())).RequireAuthorization("Admin").Produces<List<RegistrationDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.Registrations.FindAsync(id) is { } r
                ? Results.Ok(new RegistrationDto(r.Id, r.UserId, r.SeasonId, r.TeamName))
                : Results.NotFound()).RequireAuthorization("Admin").Produces<RegistrationDto>();

        // The signed-in user registers for a season with a public team name.
        group.MapPost("/", async (CreateRegistration dto, HttpContext http, FantasyDbContext db) =>
        {
            var uid = http.User.GetUserId();
            if (uid is null) return Results.Unauthorized();
            if (!await db.Seasons.AnyAsync(s => s.Id == dto.SeasonId))
                return ApiResults.RefNotFound("seasonId");
            if (NormalizeTeamName(dto.TeamName) is not { } teamName)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["teamName"] = ["Team name must be 3–40 characters and must not look like an email."]
                });

            var r = new Registration { UserId = uid, SeasonId = dto.SeasonId, TeamName = teamName };
            db.Add(r);
            // Initial email preferences (ADR-0009 amendment): upsert the kinds the user chose at sign-up.
            if (dto.EmailPreferences is { Count: > 0 })
            {
                var existing = await db.EmailPreferences.Where(p => p.UserId == uid).ToListAsync();
                foreach (var pref in dto.EmailPreferences.Where(p => ReminderKind.IsValid(p.Kind)))
                {
                    var row = existing.FirstOrDefault(x => x.Kind == pref.Kind);
                    if (row is null)
                        db.EmailPreferences.Add(new EmailPreference { UserId = uid.Value, Kind = pref.Kind, Enabled = pref.Enabled, UpdatedAt = DateTime.UtcNow });
                    else
                        (row.Enabled, row.UpdatedAt) = (pref.Enabled, DateTime.UtcNow);
                }
            }
            await db.SaveChangesAsync();
            return Results.Created($"/registrations/{r.Id}", new RegistrationDto(r.Id, r.UserId, r.SeasonId, r.TeamName));
        }).RequireAuthorization().Produces<RegistrationDto>(StatusCodes.Status201Created);

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var r = await db.Registrations.FindAsync(id);
            if (r is null) return Results.NotFound();
            db.Remove(r);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization("Admin");

        return app;
    }

    // Best-effort guard (ADR-0004): names are user free-text, so erasure tokenizes them regardless.
    private static string? NormalizeTeamName(string? raw)
    {
        var name = (raw ?? string.Empty).Trim();
        return name.Length is >= 3 and <= 40 && !name.Contains('@') ? name : null;
    }
}

public record RegistrationDto(long Id, long? UserId, long SeasonId, string TeamName);
public record CreateRegistration(long SeasonId, string TeamName, List<UpdateEmailPreference>? EmailPreferences = null);
