namespace ImsaFantasy.Domain;

/// <summary>The two picks-reminder email kinds (ADR-0009 amendment). Each is independently opt-in.</summary>
public static class ReminderKind
{
    /// <summary>Sent when the admin opens the pick board (event.picks_open true).</summary>
    public const string PicksOpen = "PicksOpen";
    /// <summary>Sent ~24h before picks lock at qualifying.</summary>
    public const string PicksClosing = "PicksClosing";

    public static readonly string[] All = [PicksOpen, PicksClosing];
    public static bool IsValid(string? kind) => kind is PicksOpen or PicksClosing;
}

/// <summary>
/// A user's opt-in for one email <see cref="Kind"/> (ADR-0009 amendment). Row present with
/// <see cref="Enabled"/> = true ⇒ the user receives that kind. Replaces the old single
/// app_user.email_reminders_enabled flag; kept kind-agnostic so new email types need no new columns.
/// Cascade-deleted with the user on erasure (ADR-0004).
/// </summary>
public class EmailPreference
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public required string Kind { get; set; }
    public bool Enabled { get; set; }
    public DateTime UpdatedAt { get; set; }

    public AppUser User { get; set; } = null!;
}

/// <summary>
/// One sent picks-reminder email, keyed to (event, user, kind) (ADR-0009). The unique (event_id, user_id)
/// index is the single-send guarantee: the worker inserts this claim row before sending, so a retry
/// across ticks, restarts, or instances is a no-op the second time. Cascade-deleted with the user on
/// erasure (ADR-0004 hard-deletes the AppUser) and with the event.
/// </summary>
public class EventReminder
{
    public long Id { get; set; }
    public long EventId { get; set; }
    public long UserId { get; set; }
    /// <summary>Which email this claim is for (<see cref="ReminderKind"/>) — one send per (event, user, kind).</summary>
    public required string Kind { get; set; }
    public DateTime SentAt { get; set; }
    /// <summary>The SES messageId returned at send (ADR-0010), so a later bounce/complaint links back here.</summary>
    public string? SesMessageId { get; set; }

    public Event Event { get; set; } = null!;
    public AppUser User { get; set; } = null!;
}

/// <summary>
/// One recorded SES bounce or complaint (ADR-0010), ingested via the SNS webhook. Audit trail +
/// correlation: <see cref="Email"/> is the affected recipient, <see cref="UserId"/> the resolved
/// account, <see cref="SesMessageId"/> the original send, <see cref="Raw"/> the full notification.
/// A permanent bounce or any complaint also stamps <see cref="AppUser.EmailSuppressedAt"/>.
/// Cascade-deleted with the user on erasure (ADR-0004).
/// </summary>
public class EmailEvent
{
    public long Id { get; set; }
    /// <summary>"Bounce" | "Complaint".</summary>
    public required string Type { get; set; }
    /// <summary>Bounce type/subtype (e.g. "Permanent/General") or complaint feedback type (e.g. "abuse").</summary>
    public string? Subtype { get; set; }
    public required string Email { get; set; }
    public long? UserId { get; set; }
    public string? SesMessageId { get; set; }
    /// <summary>The SNS delivery id — dedupe key for redelivery (unique with <see cref="Email"/>).</summary>
    public string? SnsMessageId { get; set; }
    /// <summary>Full notification payload (jsonb) for audit.</summary>
    public string Raw { get; set; } = "{}";
    public DateTime ReceivedAt { get; set; }

    public AppUser? User { get; set; }
}
