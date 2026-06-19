using ImsaFantasy.Api.Auth;
using ImsaFantasy.Api.Leaderboards;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Shared-roster leagues (ADR-0005): ranking groups over a season. Players create/join/leave;
/// owners delete. Private leagues require a join code; private boards are members-only. The
/// member's own roster is unchanged — a league only filters the season's round totals.
/// </summary>
public static class LeagueEndpoints
{
    public static IEndpointRouteBuilder MapLeagueEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/leagues").WithTags("Leagues").RequireAuthorization();

        // Discover public leagues (optionally by season), or list the caller's own with ?mine=true.
        group.MapGet("/", async (long? seasonId, bool? mine, HttpContext http, FantasyDbContext db) =>
        {
            var uid = http.User.GetUserId();
            var myRegIds = await db.Registrations.Where(r => r.UserId == uid).Select(r => r.Id).ToListAsync();

            IQueryable<League> q = db.Leagues;
            if (mine == true)
            {
                var myLeagueIdsForFilter = await db.LeagueMemberships.Where(m => myRegIds.Contains(m.RegistrationId))
                    .Select(m => m.LeagueId).ToListAsync();
                q = q.Where(l => myLeagueIdsForFilter.Contains(l.Id));
            }
            else
            {
                q = q.Where(l => l.Visibility == LeagueVisibility.Public);
            }
            if (seasonId is { } sid) q = q.Where(l => l.SeasonId == sid);

            var leagues = await q.OrderByDescending(l => l.Id).ToListAsync();
            var leagueIds = leagues.Select(l => l.Id).ToList();
            var counts = await MemberCounts(db, leagueIds);

            // Compute real per-league membership for the caller: find which of the returned leagues
            // the caller's registration(s) belong to (so the discover list reports isMember correctly).
            var myLeagueIds = (await db.LeagueMemberships
                    .Where(m => leagueIds.Contains(m.LeagueId) && myRegIds.Contains(m.RegistrationId))
                    .Select(m => m.LeagueId).ToListAsync())
                .ToHashSet();

            return Results.Ok(leagues.Select(l => ToDto(l, counts.GetValueOrDefault(l.Id), myLeagueIds.Contains(l.Id), includeCode: false)));
        }).Produces<List<LeagueDto>>();

        group.MapGet("/{id:long}", async (long id, HttpContext http, FantasyDbContext db) =>
        {
            var league = await db.Leagues.FindAsync(id);
            if (league is null) return Results.NotFound();
            var reg = await MyRegistration(db, http, league.SeasonId);
            var isMember = reg is not null && await db.LeagueMemberships.AnyAsync(m => m.LeagueId == id && m.RegistrationId == reg.Id);
            var isOwner = reg is not null && league.OwnerRegistrationId == reg.Id;
            var count = await db.LeagueMemberships.CountAsync(m => m.LeagueId == id);
            return Results.Ok(ToDto(league, count, isMember, includeCode: isOwner));
        }).Produces<LeagueDto>();

        group.MapPost("/", async (CreateLeague dto, HttpContext http, FantasyDbContext db) =>
        {
            var reg = await MyRegistration(db, http, dto.SeasonId);
            if (reg is null)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["seasonId"] = ["Register for this season before creating a league."] });
            var name = (dto.Name ?? "").Trim();
            if (name.Length is < 3 or > 50)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["Name must be 3–50 characters."] });

            var league = new League
            {
                SeasonId = dto.SeasonId,
                Name = name,
                Visibility = dto.Visibility,
                OwnerRegistrationId = reg.Id,
                JoinCode = dto.Visibility == LeagueVisibility.Private ? NewJoinCode() : null,
                CreatedAt = DateTime.UtcNow
            };
            db.Add(league);
            await db.SaveChangesAsync();

            db.Add(new LeagueMembership { LeagueId = league.Id, RegistrationId = reg.Id, JoinedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();

            return Results.Created($"/leagues/{league.Id}", ToDto(league, memberCount: 1, isMember: true, includeCode: true));
        }).Produces<LeagueDto>(StatusCodes.Status201Created);

        // Join a private league by its code alone (the "Join with Code" flow) — resolves the league
        // from the code, then applies the same membership rules as join-by-id.
        group.MapPost("/join", async (string? joinCode, HttpContext http, FantasyDbContext db) =>
        {
            var code = (joinCode ?? "").Trim().ToUpperInvariant();
            if (code.Length == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["joinCode"] = ["A join code is required."] });
            var league = await db.Leagues.FirstOrDefaultAsync(l => l.JoinCode == code);
            if (league is null) return Results.NotFound(new { error = "invalid_code" });
            var reg = await MyRegistration(db, http, league.SeasonId);
            if (reg is null)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["seasonId"] = ["Register for this league's season first."] });
            if (await db.LeagueMemberships.AnyAsync(m => m.LeagueId == league.Id && m.RegistrationId == reg.Id))
                return Results.Conflict(new { error = "already_member" });
            db.Add(new LeagueMembership { LeagueId = league.Id, RegistrationId = reg.Id, JoinedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Results.Ok(new JoinByCodeResponse(true, league.Id));
        }).Produces<JoinByCodeResponse>();

        group.MapPost("/{id:long}/join", async (long id, string? joinCode, HttpContext http, FantasyDbContext db) =>
        {
            var league = await db.Leagues.FindAsync(id);
            if (league is null) return Results.NotFound();
            var reg = await MyRegistration(db, http, league.SeasonId);
            if (reg is null)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["seasonId"] = ["Register for this league's season first."] });
            if (league.Visibility == LeagueVisibility.Private &&
                !string.Equals(joinCode, league.JoinCode, StringComparison.OrdinalIgnoreCase))
                return Results.Problem("Invalid or missing join code.", statusCode: StatusCodes.Status403Forbidden);
            if (await db.LeagueMemberships.AnyAsync(m => m.LeagueId == id && m.RegistrationId == reg.Id))
                return Results.Conflict(new { error = "already_member" });

            db.Add(new LeagueMembership { LeagueId = id, RegistrationId = reg.Id, JoinedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Results.Ok(new JoinLeagueResponse(true));
        }).Produces<JoinLeagueResponse>();

        group.MapPost("/{id:long}/leave", async (long id, HttpContext http, FantasyDbContext db) =>
        {
            var league = await db.Leagues.FindAsync(id);
            if (league is null) return Results.NotFound();
            var reg = await MyRegistration(db, http, league.SeasonId);
            if (reg is null) return Results.NotFound();
            if (league.OwnerRegistrationId == reg.Id)
                return Results.Problem("The owner cannot leave; delete the league instead.", statusCode: StatusCodes.Status400BadRequest);

            var m = await db.LeagueMemberships.FirstOrDefaultAsync(x => x.LeagueId == id && x.RegistrationId == reg.Id);
            if (m is null) return Results.NotFound();
            db.Remove(m);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapDelete("/{id:long}", async (long id, HttpContext http, FantasyDbContext db) =>
        {
            var league = await db.Leagues.FindAsync(id);
            if (league is null) return Results.NotFound();
            var reg = await MyRegistration(db, http, league.SeasonId);
            if (reg is null || league.OwnerRegistrationId != reg.Id) return Results.Forbid();
            db.Remove(league);          // memberships cascade
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapGet("/{id:long}/leaderboard", async (long id, HttpContext http, FantasyDbContext db) =>
        {
            var league = await db.Leagues.FindAsync(id);
            if (league is null) return Results.NotFound();

            var memberRegIds = await db.LeagueMemberships.Where(m => m.LeagueId == id).Select(m => m.RegistrationId).ToListAsync();
            if (league.Visibility == LeagueVisibility.Private)
            {
                var reg = await MyRegistration(db, http, league.SeasonId);
                if (reg is null || !memberRegIds.Contains(reg.Id)) return Results.Forbid();
            }

            var roundIds = await db.Rounds.Where(r => r.SeasonId == league.SeasonId).Select(r => r.Id).ToListAsync();
            var rows = (await db.RoundTotals
                    .Where(rt => roundIds.Contains(rt.RoundId) && memberRegIds.Contains(rt.RegistrationId)).ToListAsync())
                .GroupBy(rt => rt.RegistrationId)
                .Select(g => new Standings.Row(g.Key, g.Sum(x => x.Points), g.Count()))
                .ToList();

            // Private boards are members-only (guarded above), so real names are shown only to fellow
            // members (ADR-0004 amendment). Public/season boards stay team-name-only.
            var includeNames = league.Visibility == LeagueVisibility.Private;
            return Results.Ok(new LeagueLeaderboardResponse(id, league.Name, await Standings.RankAsync(db, rows, includeNames)));
        }).Produces<LeagueLeaderboardResponse>();

        return app;
    }

    private static Task<Registration?> MyRegistration(FantasyDbContext db, HttpContext http, long seasonId) =>
        db.Registrations.FirstOrDefaultAsync(r => r.UserId == http.User.GetUserId() && r.SeasonId == seasonId);

    private static async Task<Dictionary<long, int>> MemberCounts(FantasyDbContext db, List<long> leagueIds) =>
        (await db.LeagueMemberships.Where(m => leagueIds.Contains(m.LeagueId)).ToListAsync())
            .GroupBy(m => m.LeagueId).ToDictionary(g => g.Key, g => g.Count());

    private static string NewJoinCode() => Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

    private static LeagueDto ToDto(League l, int memberCount, bool isMember, bool includeCode) =>
        new(l.Id, l.SeasonId, l.Name, l.Visibility, l.OwnerRegistrationId, memberCount, isMember,
            includeCode ? l.JoinCode : null);
}

public record LeagueDto(long Id, long SeasonId, string Name, LeagueVisibility Visibility,
    long OwnerRegistrationId, int MemberCount, bool IsMember, string? JoinCode);
public record CreateLeague(long SeasonId, string Name, LeagueVisibility Visibility);
public record JoinLeagueResponse(bool Joined);
public record JoinByCodeResponse(bool Joined, long LeagueId);
public record LeagueLeaderboardResponse(long LeagueId, string Name, List<LeaderboardEntry> Entries);
