namespace ImsaFantasy.Domain;

/// <summary>
/// Qualifying grid result, per car, per class (the grid is a car concept).
/// Driver MAIN picks resolve to their car's result via the lineup (data-model).
/// </summary>
public class QualiResult
{
    public long Id { get; set; }
    public long SessionId { get; set; }
    public long CarEntryId { get; set; }
    public long ClassId { get; set; }

    /// <summary>Within-class grid position.</summary>
    public int Position { get; set; }
    public long? BestLapMs { get; set; }

    public Session Session { get; set; } = null!;
    public CarEntry CarEntry { get; set; } = null!;
    public Class Class { get; set; } = null!;
}

/// <summary>
/// Race finishing result, per car, per class — the second MAIN scoring source (race position,
/// class-relative). The grid/finish is a car concept, like qualifying.
/// </summary>
public class RaceResult
{
    public long Id { get; set; }
    public long SessionId { get; set; }
    public long CarEntryId { get; set; }
    public long ClassId { get; set; }

    /// <summary>Within-class finishing position.</summary>
    public int Position { get; set; }
    public string? Status { get; set; }
    public int? Laps { get; set; }

    public Session Session { get; set; } = null!;
    public CarEntry CarEntry { get; set; } = null!;
    public Class Class { get; set; } = null!;
}

/// <summary>Per-driver fastest race lap — the IMPACT scoring source (a lap is a driver concept).</summary>
public class RaceFastestLap
{
    public long Id { get; set; }
    public long SessionId { get; set; }
    public long DriverId { get; set; }
    public long ClassId { get; set; }
    public long FastestLapMs { get; set; }

    public Session Session { get; set; } = null!;
    public Driver Driver { get; set; } = null!;
    public Class Class { get; set; } = null!;
}
