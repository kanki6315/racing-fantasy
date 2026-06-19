namespace ImsaFantasy.Domain;

/// <summary>
/// Versioned scoring rules per season and <see cref="ScoringSource"/> (ADR-0003). MAIN picks are
/// scored by two sources (QualifyingPosition + RacePosition); IMPACT by RaceFastestLap.
/// </summary>
public class ScoringRuleset
{
    public long Id { get; set; }
    public long SeasonId { get; set; }
    public ScoringSource Source { get; set; }
    public int Version { get; set; }
    public RulesetStatus Status { get; set; } = RulesetStatus.Draft;
    public DateTime EffectiveFrom { get; set; }

    public Season Season { get; set; } = null!;
    public ICollection<PositionPoints> PositionPoints { get; set; } = new List<PositionPoints>();
    public ICollection<ScoringBonus> Bonuses { get; set; } = new List<ScoringBonus>();
}

/// <summary>Rank → points map. Ranking is class-relative; points are class-agnostic (ADR-0003).</summary>
public class PositionPoints
{
    public long Id { get; set; }
    public long RulesetId { get; set; }
    public int Rank { get; set; }
    public decimal Points { get; set; }

    public ScoringRuleset Ruleset { get; set; } = null!;
}

/// <summary>Extra scoring rules (pole, beat-teammate, …) expressed as data.</summary>
public class ScoringBonus
{
    public long Id { get; set; }
    public long RulesetId { get; set; }
    public required string Kind { get; set; }

    /// <summary>jsonb parameters for the bonus.</summary>
    public string Params { get; set; } = "{}";

    public ScoringRuleset Ruleset { get; set; } = null!;
}

/// <summary>
/// Points for one scoring source, owned by **exactly one** of a pick or a roster modifier
/// (ADR-0006 D4). MAIN picks own up to two rows (QualifyingPosition + RacePosition);
/// <see cref="RosterModifier"/>s own their <see cref="ScoringSource.Bonus"/> rows. Idempotent
/// recompute key: (PickId | RosterModifierId, Source); RuleVersion is stamped for reproducibility
/// (ADR-0003 D8).
/// </summary>
public class Score
{
    public long Id { get; set; }
    public long RosterId { get; set; }
    public long? PickId { get; set; }
    public long? RosterModifierId { get; set; }
    public ScoringSource Source { get; set; }
    public decimal Points { get; set; }
    public int RuleVersion { get; set; }
    public DateTime ComputedAt { get; set; }

    public Roster Roster { get; set; } = null!;
    public Pick? Pick { get; set; }
    public RosterModifier? RosterModifier { get; set; }
}

/// <summary>One row per recompute — explains overnight score changes (ADR-0003). Owned by the same
/// pick or modifier as its <see cref="Score"/>.</summary>
public class ScoreAudit
{
    public long Id { get; set; }
    public long? PickId { get; set; }
    public long? RosterModifierId { get; set; }
    public ScoringSource Source { get; set; }
    public int RuleVersion { get; set; }
    public decimal OldPoints { get; set; }
    public decimal NewPoints { get; set; }
    public string? Reason { get; set; }
    public DateTime ComputedAt { get; set; }

    public Pick? Pick { get; set; }
    public RosterModifier? RosterModifier { get; set; }
}

/// <summary>Running sum of scored points for a user in a round (MAIN + IMPACT as each phase lands) (ADR-0003 D7).</summary>
public class RoundTotal
{
    public long Id { get; set; }
    public long RegistrationId { get; set; }
    public long RoundId { get; set; }
    public decimal Points { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Registration Registration { get; set; } = null!;
    public Round Round { get; set; } = null!;
}
