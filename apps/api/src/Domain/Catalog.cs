namespace ImsaFantasy.Domain;

/// <summary>A championship series: WeatherTech, Pilot Challenge, MX-5 Cup, …</summary>
public class Championship
{
    public long Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
    /// <summary>Constant sort key — lower sorts first, ahead of higher. Column <c>sort_order</c>;
    /// exposed to clients as <c>order</c>. Lets certain series rank above others everywhere.</summary>
    public int SortOrder { get; set; }

    public ICollection<Season> Seasons { get; set; } = new List<Season>();
    public ICollection<Class> Classes { get; set; } = new List<Class>();
}

/// <summary>A championship's running of a single year.</summary>
public class Season
{
    public long Id { get; set; }
    public long ChampionshipId { get; set; }
    public int Year { get; set; }

    public Championship Championship { get; set; } = null!;
    public ICollection<Round> Rounds { get; set; } = new List<Round>();
}

/// <summary>A competition class within a championship: GTP / LMP2 / GTD PRO / GTD; GS / TCR; MX-5.</summary>
public class Class
{
    public long Id { get; set; }
    public long ChampionshipId { get; set; }
    public required string Name { get; set; }

    /// <summary>Identity color as a #RRGGBB hex string, or null to fall back to the client-derived palette.</summary>
    public string? Color { get; set; }

    /// <summary>Display rank within a championship (lower sorts first; mirrors <see cref="Championship"/>'s
    /// sort_order). Drives class order everywhere classes are listed — pick board, picks view, admin —
    /// so the racing order (GTP, LMP2, GTD PRO, GTD) can be expressed instead of falling back to name.</summary>
    public int SortOrder { get; set; }

    public Championship Championship { get; set; } = null!;
}

/// <summary>
/// A physical race weekend shared across championships (ADR-0007). Carries the shared weekend
/// identity; championships opt in by attaching a <see cref="Round"/> (each with its own quali time).
/// </summary>
public class Event
{
    public long Id { get; set; }
    public required string Name { get; set; }
    public string? Circuit { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    /// <summary>Whether the pick board for this weekend has been released. Gates the COMING SOON →
    /// PICKS OPEN transition for every championship racing here at once; per-round quali still locks
    /// picks automatically. Admin-toggled once all series' entry lists are published.</summary>
    public bool PicksOpen { get; set; }

    /// <summary>When <see cref="PicksOpen"/> last transitioned to true (null when closed). Bounds the
    /// PicksOpen reminder to a fresh window so it isn't sent long after opening (ADR-0009 amendment).</summary>
    public DateTime? PicksOpenedAt { get; set; }

    public ICollection<Round> Rounds { get; set; } = new List<Round>();
}

/// <summary>A race weekend / event. <see cref="QualiStart"/> is THE lock boundary (ADR-0002).</summary>
public class Round
{
    public long Id { get; set; }
    public long SeasonId { get; set; }
    /// <summary>Optional shared weekend this round opts into (ADR-0007); null = standalone.</summary>
    public long? EventId { get; set; }
    public required string Name { get; set; }
    public string? Circuit { get; set; }
    public int Sequence { get; set; }

    /// <summary>The single lock boundary for the whole round (ADR-0002).</summary>
    public DateTime QualiStart { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    /// <summary>The salary cap for this round's roster (ADR-0001 D2 — per round, not per registration).</summary>
    public decimal SalaryCap { get; set; }

    public Season Season { get; set; } = null!;
    public Event? Event { get; set; }
    public ICollection<Session> Sessions { get; set; } = new List<Session>();
}

/// <summary>A per-class session within a round. Carries results; is NOT the lock source.</summary>
public class Session
{
    public long Id { get; set; }
    public long RoundId { get; set; }
    public long ClassId { get; set; }
    public SessionType Type { get; set; }

    /// <summary>Ordinal within (round, class, type) for multi-race weekends (MX-5 style R1/R2).
    /// Always 1 for Qualifying.</summary>
    public int RaceNumber { get; set; } = 1;
    public DateTime? ScheduledStart { get; set; }
    public DateTime? ActualStart { get; set; }
    public SessionStatus Status { get; set; } = SessionStatus.Scheduled;

    public Round Round { get; set; } = null!;
    public Class Class { get; set; } = null!;
}
