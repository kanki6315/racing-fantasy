using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Leaderboards;

/// <summary>
/// Shared ranking for the season board and per-league boards (ADR-0005). Takes per-registration
/// point rows, attaches team names (the only public identifier — ADR-0004), and assigns competition
/// ranks (ties share a rank). By default no user identity is exposed; <paramref name="includeMemberNames"/>
/// additionally attaches each member's real account name and is used **only for private-league boards**
/// (ADR-0004 amendment) — never the season/round/public boards. An optional <paramref name="movement"/>
/// map stamps each entry's round-over-round rank change (see <see cref="ComputeMovement"/>).
/// </summary>
public static class Standings
{
    public readonly record struct Row(long RegistrationId, decimal Points, int RoundsScored);

    public static async Task<List<LeaderboardEntry>> RankAsync(
        FantasyDbContext db, IReadOnlyCollection<Row> rows, bool includeMemberNames = false,
        IReadOnlyDictionary<long, int>? movement = null)
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
                names.GetValueOrDefault(row.RegistrationId),
                movement is not null && movement.TryGetValue(row.RegistrationId, out var m) ? m : null));
        }
        return entries;
    }

    /// <summary>
    /// Per-registration change in cumulative rank caused by the most recently scored round — the ▲/▼ on the
    /// season board. Ranks the cumulative standings through the latest scored round against the standings
    /// through the round before it; movement = priorRank − currentRank (positive = climbed). Returns an empty
    /// map until at least two rounds are scored (no prior state to compare), and omits any registration that
    /// wasn't ranked in the prior round (a first appearance has no movement, renders as "NEW"/"—").
    /// <paramref name="totals"/> is every round_total for the season's rounds; <paramref name="orderedRoundIds"/>
    /// is those rounds in season sequence.
    /// </summary>
    public static Dictionary<long, int> ComputeMovement(
        IReadOnlyCollection<RoundTotal> totals, IReadOnlyList<long> orderedRoundIds)
    {
        var scored = orderedRoundIds.Where(rid => totals.Any(t => t.RoundId == rid)).ToList();
        if (scored.Count < 2) return new();
        var current = scored.ToHashSet();
        var prior = scored.Take(scored.Count - 1).ToHashSet();

        Dictionary<long, int> RankThrough(HashSet<long> rounds)
        {
            var ranks = new Dictionary<long, int>();
            var sums = totals.Where(t => rounds.Contains(t.RoundId))
                .GroupBy(t => t.RegistrationId)
                .Select(g => new { Reg = g.Key, Pts = g.Sum(x => x.Points) })
                .OrderByDescending(x => x.Pts)
                .ToList();
            int rank = 0, index = 0;
            decimal? prev = null;
            foreach (var s in sums)
            {
                index++;
                if (prev is null || s.Pts != prev) rank = index;
                prev = s.Pts;
                ranks[s.Reg] = rank;
            }
            return ranks;
        }

        var currentRanks = RankThrough(current);
        var priorRanks = RankThrough(prior);
        var movement = new Dictionary<long, int>();
        foreach (var (reg, curRank) in currentRanks)
            if (priorRanks.TryGetValue(reg, out var pr)) movement[reg] = pr - curRank;
        return movement;
    }
}

/// <summary>
/// <see cref="Name"/> is the member's real account name; null except on private-league boards.
/// <see cref="Movement"/> is the round-over-round rank change on cumulative boards (positive = climbed);
/// null on single-round boards and for a registration's first scored round.
/// </summary>
public record LeaderboardEntry(
    int Rank, long RegistrationId, string TeamName, decimal Points, int RoundsScored,
    string? Name = null, int? Movement = null);
