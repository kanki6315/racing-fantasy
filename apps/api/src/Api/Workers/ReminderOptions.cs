namespace ImsaFantasy.Api.Workers;

/// <summary>
/// When the per-weekend picks reminder fires (ADR-0009 D2). Both modes derive from data we already
/// hold (event.picks_open / round.quali_start), so the choice is a config value, not schema.
/// </summary>
public enum ReminderMode
{
    /// <summary>Fire once the event's pick board is released (event.picks_open = true).</summary>
    AtOpen,

    /// <summary>Fire <see cref="ReminderOptions.HoursBeforeClose"/> hours before the weekend's earliest
    /// quali_start (the lock/close boundary, ADR-0002).</summary>
    HoursBeforeClose,
}

/// <summary>
/// Config for the picks-reminder worker (bound from the "Reminders" section, ADR-0009). Disabled by
/// default so nothing sends until an operator opts in; the worker additionally no-ops when SES is
/// unconfigured or there are no opted-in recipients.
/// </summary>
public sealed class ReminderOptions
{
    /// <summary>Master switch — the worker idles until set true.</summary>
    public bool Enabled { get; set; }

    /// <summary>At-open vs N-hours-before-close. Decided at deploy time (ADR-0009 D2).</summary>
    public ReminderMode Mode { get; set; } = ReminderMode.AtOpen;

    /// <summary>Lead time for <see cref="ReminderMode.HoursBeforeClose"/> (ignored in AtOpen mode).</summary>
    public int HoursBeforeClose { get; set; } = 24;

    /// <summary>Worker poll interval in seconds (default 5 min).</summary>
    public int PollSeconds { get; set; } = 300;

    /// <summary>Base URL of the player web app, for the "set your picks" link (no trailing slash).</summary>
    public string? WebBaseUrl { get; set; }

    /// <summary>Base URL of this API, for the one-click unsubscribe link (no trailing slash).</summary>
    public string? ApiBaseUrl { get; set; }
}
