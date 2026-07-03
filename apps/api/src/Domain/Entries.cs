namespace ImsaFantasy.Domain;

/// <summary>A car (number + team) entered in a class for a season — a "team" pick target.</summary>
public class CarEntry
{
    public long Id { get; set; }
    public long SeasonId { get; set; }
    public long ClassId { get; set; }
    public required string Number { get; set; }
    public required string TeamName { get; set; }

    /// <summary>Chassis/model as printed on the entry list (e.g. "ORECA LMP2 07"). Not decomposed
    /// into a manufacturer — first-token splitting fails ("Aston Martin …", "Mercedes-AMG …").</summary>
    public string? CarModel { get; set; }

    /// <summary>Bronze Cup sub-classification (am-driver award in VP Racing Challenge / Pilot Challenge).</summary>
    public bool BronzeCup { get; set; }

    public Season Season { get; set; } = null!;
    public Class Class { get; set; } = null!;
    public ICollection<EntryDriver> Lineup { get; set; } = new List<EntryDriver>();
}

/// <summary>A driver — a pick target and the subject of fastest-lap (IMPACT) scoring.</summary>
public class Driver
{
    public long Id { get; set; }
    public required string FullName { get; set; }
    public string? Country { get; set; }
}

/// <summary>
/// Lineup join: which drivers share a car (handles endurance co-drivers).
/// Resolves a driver MAIN pick to its car's qualifying result (ADR / data-model).
/// <para>Round scoping mirrors <c>roster_rule.round_id</c>: <see cref="RoundId"/> NULL is a
/// season-wide row (legacy/manual); a set round pins the row to that weekend's entry list.
/// Readers prefer a car's round rows over its NULL rows, so lineups, ratings and markers are
/// per-event where the entry-list import has run and fall back to season behavior elsewhere.</para>
/// </summary>
public class EntryDriver
{
    public long Id { get; set; }
    public long CarEntryId { get; set; }
    public long DriverId { get; set; }
    public long SeasonId { get; set; }

    /// <summary>Round this lineup row applies to; NULL = season-wide default.</summary>
    public long? RoundId { get; set; }

    /// <summary>Driver categorisation as printed on the entry list (some series adjust the FIA
    /// standard, so it is entry-scoped, not a driver attribute).</summary>
    public DriverRating? Rating { get; set; }

    /// <summary>1-based position in the car's listed lineup; NULL on legacy rows (insertion-id order).</summary>
    public int? SlotOrder { get; set; }

    public bool IsRookie { get; set; }
    public bool IsCoach { get; set; }

    public CarEntry CarEntry { get; set; } = null!;
    public Driver Driver { get; set; } = null!;
    public Round? Round { get; set; }
}

/// <summary>
/// Per-round price for a pickable entity. Prices change every round (ADR-0001 D2).
/// Polymorphic: <see cref="EntityId"/> references a CarEntry or Driver per <see cref="EntityType"/> (no FK, ADR-0001 D3).
/// </summary>
public class EntityPrice
{
    public long Id { get; set; }
    public long RoundId { get; set; }
    public EntityType EntityType { get; set; }
    public long EntityId { get; set; }
    public long ClassId { get; set; }
    public decimal Price { get; set; }

    public Round Round { get; set; } = null!;
    public Class Class { get; set; } = null!;
}
