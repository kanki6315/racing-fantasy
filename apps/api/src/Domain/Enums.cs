namespace EnduranceFantasy.Domain;

/// <summary>
/// Which roster slot a pick occupies (ADR-0001 D5/D6). <see cref="Impact"/> is **deprecated**
/// (ADR-0006): the IMPACT "bonus driver" slot is no longer produced by the roster flow — picks are
/// MAIN-only and bonuses come from <see cref="RosterModifier"/>s. The value is retained to avoid a
/// destructive migration of historical rows.
/// </summary>
public enum SlotType
{
    Main,
    Impact
}

/// <summary>Polymorphic pickable entity kind (ADR-0001 D3). IMPACT picks are always Driver.</summary>
public enum EntityType
{
    Car,
    Driver
}

/// <summary>Session kind within a round. MAIN scores from Qualifying, IMPACT from Race fastest lap.</summary>
public enum SessionType
{
    Qualifying,
    Race
}

public enum SessionStatus
{
    Scheduled,
    Live,
    Complete,
    Published
}

/// <summary>Lifecycle of a versioned scoring ruleset (ADR-0003).</summary>
public enum RulesetStatus
{
    Draft,
    Active,
    Archived
}

/// <summary>
/// What a scoring ruleset/score is measuring. MAIN picks score on QualifyingPosition and
/// RacePosition. <see cref="Bonus"/> rows are emitted by <see cref="RosterModifier"/> handlers
/// (ADR-0006) and are owned by a modifier, not a pick. <see cref="RaceFastestLap"/> backed the
/// retired IMPACT slot and is now dormant.
/// </summary>
public enum ScoringSource
{
    QualifyingPosition,
    RacePosition,
    RaceFastestLap,
    Bonus
}

/// <summary>League visibility (ADR-0005). Private leagues require a join code.</summary>
public enum LeagueVisibility
{
    Public,
    Private
}

/// <summary>
/// Driver categorisation from the entry list (FIA P/G/S/B letters). Lives on
/// <see cref="EntryDriver"/> — ratings are per season and some series adjust them mid-year.
/// </summary>
public enum DriverRating
{
    Platinum,
    Gold,
    Silver,
    Bronze
}
