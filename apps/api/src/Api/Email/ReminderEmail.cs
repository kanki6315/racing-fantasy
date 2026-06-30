using System.Reflection;
using ImsaFantasy.Api.Workers;

namespace ImsaFantasy.Api.Email;

/// <summary>Inputs for one reminder email. One email per event; the unsubscribe link is per-recipient.</summary>
public sealed record ReminderEmailModel(
    string EventName,
    DateTime CloseAtUtc,   // earliest quali_start across the event's rounds (the lock/close)
    string CtaUrl,
    string UnsubscribeUrl);

/// <summary>
/// Builds the subject + HTML body for the picks-reminder email (ADR-0009 D6). The compiled MJML
/// template (picks-reminder.html) is loaded once from embedded resources; tokens are filled per send.
/// Both the subject and the in-body copy vary by <see cref="ReminderMode"/> (open vs closing soon).
/// </summary>
public static class ReminderEmail
{
    private static readonly string Template = LoadTemplate();

    /// <summary>The two subject lines (ADR-0009; wording chosen by the product owner).</summary>
    public static string Subject(ReminderMode mode, string eventName) => mode == ReminderMode.HoursBeforeClose
        ? $"Fantasy Picks for {eventName} are Closing Soon"
        : $"Fantasy Picks for {eventName} are Open";

    public static string RenderHtml(ReminderMode mode, ReminderEmailModel m)
    {
        var closing = mode == ReminderMode.HoursBeforeClose;
        // quali_start is stored UTC; render it explicitly labelled to avoid timezone ambiguity.
        var deadline = $"{m.CloseAtUtc:ddd, MMM d} at {m.CloseAtUtc:HH:mm} UTC";

        var tokens = new Dictionary<string, string>
        {
            ["preheader"] = closing
                ? $"Picks lock at qualifying — {deadline}."
                : $"The pick board is open for {m.EventName}.",
            ["statusLabel"] = closing ? "Picks closing soon" : "Picks open",
            ["eventName"] = m.EventName,
            ["intro"] = closing
                ? $"Last chance to set your roster for {m.EventName} before picks lock at qualifying."
                : $"The pick board is open for {m.EventName}. Set your roster before it locks at qualifying.",
            ["deadlineLine"] = $"Picks lock at qualifying — {deadline}.",
            ["ctaLabel"] = closing ? "Finish your picks" : "Set your picks",
            ["ctaUrl"] = m.CtaUrl,
            ["unsubscribeUrl"] = m.UnsubscribeUrl,
        };

        var html = Template;
        foreach (var (key, value) in tokens)
            // HTML-encode every value: a stray & / < in an event name must not break the markup, and
            // & in a URL becomes the correct &amp; inside an href attribute.
            html = html.Replace("{{" + key + "}}", System.Net.WebUtility.HtmlEncode(value));
        return html;
    }

    private static string LoadTemplate()
    {
        var asm = Assembly.GetExecutingAssembly();
        var name = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("picks-reminder.html", StringComparison.Ordinal))
            ?? throw new InvalidOperationException("Embedded picks-reminder.html not found.");
        using var stream = asm.GetManifestResourceStream(name)!;
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
