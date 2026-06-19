namespace ImsaFantasy.Domain;

/// <summary>A car (number + team) entered in a class for a season — a "team" pick target.</summary>
public class CarEntry
{
    public long Id { get; set; }
    public long SeasonId { get; set; }
    public long ClassId { get; set; }
    public required string Number { get; set; }
    public required string TeamName { get; set; }

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
/// Lineup join: which drivers share a car for a season (handles endurance co-drivers).
/// Resolves a driver MAIN pick to its car's qualifying result (ADR / data-model).
/// </summary>
public class EntryDriver
{
    public long Id { get; set; }
    public long CarEntryId { get; set; }
    public long DriverId { get; set; }
    public long SeasonId { get; set; }

    public CarEntry CarEntry { get; set; } = null!;
    public Driver Driver { get; set; } = null!;
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
