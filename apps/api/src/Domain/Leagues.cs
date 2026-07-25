namespace EnduranceFantasy.Domain;

/// <summary>
/// A ranking group over a season (ADR-0005, shared-roster). Members compete on the same rosters
/// they already submit; the league leaderboard is the season's round totals filtered to members.
/// Private leagues require <see cref="JoinCode"/>.
/// </summary>
public class League
{
    public long Id { get; set; }
    public long SeasonId { get; set; }
    public required string Name { get; set; }
    public LeagueVisibility Visibility { get; set; }
    public long OwnerRegistrationId { get; set; }
    public string? JoinCode { get; set; }
    public DateTime CreatedAt { get; set; }

    public Season Season { get; set; } = null!;
    public Registration OwnerRegistration { get; set; } = null!;
    public ICollection<LeagueMembership> Members { get; set; } = new List<LeagueMembership>();
}

/// <summary>A registration's membership in a league. A registration can join many leagues.</summary>
public class LeagueMembership
{
    public long Id { get; set; }
    public long LeagueId { get; set; }
    public long RegistrationId { get; set; }
    public DateTime JoinedAt { get; set; }

    public League League { get; set; } = null!;
    public Registration Registration { get; set; } = null!;
}
