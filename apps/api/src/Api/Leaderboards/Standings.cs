using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Leaderboards;

/// <summary>
/// Shared ranking for the season board and per-league boards (ADR-0005). Takes per-registration
/// point rows, attaches team names (the only public identifier — ADR-0004), and assigns competition
/// ranks (ties share a rank). By default no user identity is exposed; <paramref name="includeMemberNames"/>
/// additionally attaches each member's real account name and is used **only for private-league boards**
/// (ADR-0004 amendment) — never the season/round/public boards.
/// </summary>
public static class Standings
{
    public readonly record struct Row(long RegistrationId, decimal Points, int RoundsScored);

    public static async Task<List<LeaderboardEntry>> RankAsync(
        FantasyDbContext db, IReadOnlyCollection<Row> rows, bool includeMemberNames = false)
    {
        var regIds = rows.Select(r => r.RegistrationId).ToList();
        var teamNames = await db.Registrations.Where(r => regIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id, r => r.TeamName);

        Dictionary<long, string?> names = includeMemberNames
            ? await db.Registrations.Where(r => regIds.Contains(r.Id) && r.UserId != null)
                .Select(r => new { r.Id, Name = r.User!.Name })
                .ToDictionaryAsync(x => x.Id, x => x.Name)
            : new();

        var entries = new List<LeaderboardEntry>(rows.Count);
        int rank = 0, index = 0;
        decimal? prev = null;
        foreach (var row in rows.OrderByDescending(r => r.Points))
        {
            index++;
            if (prev is null || row.Points != prev) rank = index;
            prev = row.Points;
            entries.Add(new LeaderboardEntry(
                rank, row.RegistrationId,
                teamNames.GetValueOrDefault(row.RegistrationId, "(unknown)"), row.Points, row.RoundsScored,
                names.GetValueOrDefault(row.RegistrationId)));
        }
        return entries;
    }
}

/// <summary><see cref="Name"/> is the member's real account name; null except on private-league boards.</summary>
public record LeaderboardEntry(int Rank, long RegistrationId, string TeamName, decimal Points, int RoundsScored, string? Name = null);
