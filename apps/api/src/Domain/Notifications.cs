namespace ImsaFantasy.Domain;

/// <summary>
/// One sent picks-reminder email, keyed to (event, user) (ADR-0009). The unique (event_id, user_id)
/// index is the single-send guarantee: the worker inserts this claim row before sending, so a retry
/// across ticks, restarts, or instances is a no-op the second time. Cascade-deleted with the user on
/// erasure (ADR-0004 hard-deletes the AppUser) and with the event.
/// </summary>
public class EventReminder
{
    public long Id { get; set; }
    public long EventId { get; set; }
    public long UserId { get; set; }
    public DateTime SentAt { get; set; }

    public Event Event { get; set; } = null!;
    public AppUser User { get; set; } = null!;
}
