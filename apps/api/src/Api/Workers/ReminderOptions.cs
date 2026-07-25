namespace EnduranceFantasy.Api.Workers;

/// <summary>
/// Config for the picks-reminder worker (bound from the "Reminders" section, ADR-0009). The reminder
/// fires <see cref="HoursBeforeClose"/> hours before the weekend's earliest quali_start (pick lock,
/// ADR-0002). Disabled by default so nothing sends until an operator opts in; the worker additionally
/// no-ops when SES is unconfigured or there are no opted-in recipients.
/// </summary>
public sealed class ReminderOptions
{
    /// <summary>Master switch — the worker idles until set true.</summary>
    public bool Enabled { get; set; }

    /// <summary>Lead time before the weekend's earliest quali_start (the lock/close, ADR-0002).</summary>
    public int HoursBeforeClose { get; set; } = 24;

    /// <summary>How long after picks open the PicksOpen email may still send — so it isn't sent stale
    /// long after opening (ADR-0009 amendment). Beyond this window, PicksOpen is skipped.</summary>
    public int PicksOpenWindowHours { get; set; } = 24;

    /// <summary>Worker poll interval in seconds (default 5 min).</summary>
    public int PollSeconds { get; set; } = 300;

    /// <summary>Base URL of the player web app, for the "set your picks" link (no trailing slash).</summary>
    public string? WebBaseUrl { get; set; }

    /// <summary>Base URL of this API, for the one-click unsubscribe link (no trailing slash).</summary>
    public string? ApiBaseUrl { get; set; }

    /// <summary>HMAC secret for signing unsubscribe tokens. Required to send (links must be verifiable).</summary>
    public string? UnsubscribeSecret { get; set; }
}
