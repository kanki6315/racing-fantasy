namespace ImsaFantasy.Domain;

/// <summary>
/// The account identity, keyed by a pseudonymous external subject. Per the ADR-0004 amendment
/// (2026-06-17) we now also store the provider's <see cref="Name"/> and <see cref="Email"/> (both
/// nullable). These are private profile attributes — never the public leaderboard label, which is
/// the per-registration <see cref="Registration.TeamName"/>. <see cref="Name"/> is shown only to
/// fellow members of a *private* league; <see cref="Email"/> only to the account holder. Both are
/// deleted with the account on erasure.
/// </summary>
public class AppUser
{
    public long Id { get; set; }
    public required string ExternalProvider { get; set; }
    public required string ExternalSubject { get; set; }
    public string? Name { get; set; }
    public string? Email { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<Registration> Registrations { get; set; } = new List<Registration>();
}

/// <summary>
/// A user's enrollment in one season (per-championship opt-in), carrying the public
/// <see cref="TeamName"/> shown on leaderboards (ADR-0004). The salary cap lives on the
/// <see cref="Round"/> (ADR-0001 D2), not here. On erasure the user link is severed
/// (<see cref="UserId"/> → null) and the team name is replaced with a neutral token, leaving an
/// anonymous record.
/// </summary>
public class Registration
{
    public long Id { get; set; }
    public long? UserId { get; set; }
    public long SeasonId { get; set; }
    public required string TeamName { get; set; }

    public AppUser? User { get; set; }
    public Season Season { get; set; } = null!;
    public ICollection<Roster> Rosters { get; set; } = new List<Roster>();
}

/// <summary>
/// Legal roster shape per class and slot (ADR-0001 D5). A null <see cref="ClassId"/> means
/// "any class" — used to bound IMPACT picks across all classes.
/// </summary>
public class RosterRule
{
    public long Id { get; set; }
    public long SeasonId { get; set; }
    public long? ClassId { get; set; }
    public SlotType SlotType { get; set; }
    public int MinPicks { get; set; }
    public int MaxPicks { get; set; }

    public Season Season { get; set; } = null!;
    public Class? Class { get; set; }
}

/// <summary>A user's picks for one round (one per registration per round). Freezes at the round's quali start (ADR-0002).</summary>
public class Roster
{
    public long Id { get; set; }
    public long RegistrationId { get; set; }
    public long RoundId { get; set; }

    /// <summary>Set by the lock-sweep worker at quali start; null until locked (ADR-0002).</summary>
    public DateTime? LockedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Registration Registration { get; set; } = null!;
    public Round Round { get; set; } = null!;
    public ICollection<Pick> Picks { get; set; } = new List<Pick>();
    public ICollection<RosterModifier> Modifiers { get; set; } = new List<RosterModifier>();
}

/// <summary>
/// Which modifiers a season offers, how many of each per round, and the input the player supplies
/// (ADR-0006 D3). <see cref="AppliesTo"/> names the target shape so the resolver/UI know which
/// selector to render and validation knows what to expect: <c>MainPick</c> | <c>Driver</c> |
/// <c>Manufacturer</c> | <c>None</c>.
/// </summary>
public class RosterModifierRule
{
    public long Id { get; set; }
    public long SeasonId { get; set; }
    public required string Kind { get; set; }
    public int MaxCount { get; set; } = 1;
    public required string AppliesTo { get; set; }

    public Season Season { get; set; } = null!;
}

/// <summary>
/// A player's modifier selection for one round (ADR-0006). Free (no salary). Pick-targeted kinds
/// (DOUBLE_POINTS_TEAM, CAPTAIN) set <see cref="TargetPickId"/>; kinds targeting something else
/// (a future MANUFACTURER_COMBINE) carry their selection in <see cref="Params"/> jsonb and leave the
/// target null. Rewritten in the same lock transaction as the picks it references (ADR-0001 D5).
/// </summary>
public class RosterModifier
{
    public long Id { get; set; }
    public long RosterId { get; set; }
    public required string Kind { get; set; }
    public long? TargetPickId { get; set; }
    public string Params { get; set; } = "{}";

    public Roster Roster { get; set; } = null!;
    public Pick? TargetPick { get; set; }
}

/// <summary>
/// One selected entity in a roster. Polymorphic <see cref="EntityId"/> (CarEntry or Driver, no FK).
/// IMPACT picks must be Drivers. <see cref="PriceAtLock"/> is snapshotted at lock (ADR-0001 D4).
/// <see cref="ClassId"/> is denormalised so the composition check is one GROUP BY (data-model).
/// </summary>
public class Pick
{
    public long Id { get; set; }
    public long RosterId { get; set; }
    public SlotType SlotType { get; set; }
    public EntityType EntityType { get; set; }
    public long EntityId { get; set; }
    public long ClassId { get; set; }
    public decimal PriceAtLock { get; set; }

    public Roster Roster { get; set; } = null!;
    public Class Class { get; set; } = null!;
}
