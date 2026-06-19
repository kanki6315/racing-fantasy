using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Account administration and data-subject rights (ADR-0004). Users are created by the Google
/// first-login flow, not here. Erasure anonymizes (severs the user link, replaces team names with
/// a neutral token) and keeps game data; export satisfies an access request.
/// </summary>
public static class UserEndpoints
{
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/users").WithTags("Users").RequireAuthorization("Admin");

        group.MapGet("/", async (FantasyDbContext db) =>
            Results.Ok(await db.Users.OrderBy(u => u.Id)
                .Select(u => new UserDto(u.Id, u.ExternalProvider, u.CreatedAt, u.Registrations.Count))
                .ToListAsync())).Produces<List<UserDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.Users.Where(u => u.Id == id)
                .Select(u => new UserDto(u.Id, u.ExternalProvider, u.CreatedAt, u.Registrations.Count))
                .FirstOrDefaultAsync() is { } dto
                ? Results.Ok(dto) : Results.NotFound()).Produces<UserDto>();

        // Right to erasure (GDPR Art. 17): delete identity, sever links, neutral-token the team names,
        // retain anonymous game data so leaderboard history survives.
        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var user = await db.Users.Include(u => u.Registrations).FirstOrDefaultAsync(u => u.Id == id);
            if (user is null) return Results.NotFound();

            foreach (var reg in user.Registrations)
            {
                reg.UserId = null;
                reg.TeamName = $"Retired Team #{reg.Id}";
            }
            await db.SaveChangesAsync();        // sever links first

            db.Users.Remove(user);
            await db.SaveChangesAsync();         // then delete the identity

            return Results.NoContent();
        });

        // Right of access (GDPR Art. 15): everything we hold for this user.
        group.MapGet("/{id:long}/export", async (long id, FantasyDbContext db) =>
        {
            var user = await db.Users.FindAsync(id);
            if (user is null) return Results.NotFound();

            var registrations = await db.Registrations.Where(r => r.UserId == id).ToListAsync();
            var regIds = registrations.Select(r => r.Id).ToList();
            var rosters = await db.Rosters.Where(r => regIds.Contains(r.RegistrationId)).Include(r => r.Picks).ToListAsync();

            return Results.Ok(new
            {
                account = new { user.Id, user.ExternalProvider, user.ExternalSubject, user.Name, user.Email, user.CreatedAt },
                registrations = registrations.Select(r => new
                {
                    r.Id, r.SeasonId, r.TeamName,
                    rosters = rosters.Where(x => x.RegistrationId == r.Id).Select(x => new
                    {
                        x.RoundId, x.LockedAt,
                        picks = x.Picks.Select(p => new { p.SlotType, p.EntityType, p.EntityId, p.ClassId, p.PriceAtLock })
                    })
                })
            });
        });

        return app;
    }
}

public record UserDto(long Id, string ExternalProvider, DateTime CreatedAt, int RegistrationCount);
