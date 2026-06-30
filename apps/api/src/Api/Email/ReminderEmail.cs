using System.Reflection;

namespace ImsaFantasy.Api.Email;

/// <summary>Inputs for one reminder email. One email per event; the unsubscribe link is per-recipient.</summary>
public sealed record ReminderEmailModel(
    string EventName,
    DateTime CloseAtUtc,   // earliest quali_start across the event's rounds (the lock/close)
    string CtaUrl,
    string UnsubscribeUrl);

/// <summary>
/// Builds the subject + HTML body for the picks-reminder email (ADR-0009 D6). The reminder fires
/// ~24h before picks lock at qualifying, so the copy is a single "closing soon" voice. The compiled
/// MJML template (picks-reminder.html) is loaded once from embedded resources; tokens filled per send.
/// </summary>
public static class ReminderEmail
{
    private static readonly string Template = LoadTemplate();

    public static string Subject(string eventName) => $"Fantasy Picks for {eventName} are Closing Soon";

    public static string RenderHtml(ReminderEmailModel m)
    {
        // quali_start is stored UTC; show it in US Eastern (IMSA races) with the correct EST/EDT label.
        var deadline = FormatEastern(m.CloseAtUtc);

        var tokens = new Dictionary<string, string>
        {
            ["preheader"] = $"Picks lock at qualifying — {deadline}.",
            ["statusLabel"] = "Picks closing soon",
            ["eventName"] = m.EventName,
            ["intro"] = $"Last chance to set your roster for {m.EventName} before picks lock at qualifying.",
            ["deadlineLine"] = $"Picks lock at qualifying — {deadline}.",
            ["ctaLabel"] = "Set your picks",
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

    private static readonly TimeZoneInfo Eastern = ResolveEastern();

    private static TimeZoneInfo ResolveEastern()
    {
        foreach (var id in new[] { "America/New_York", "Eastern Standard Time" })
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { /* try next id */ }
        return TimeZoneInfo.Utc; // last resort — labelled UTC below
    }

    private static string FormatEastern(DateTime utc)
    {
        var et = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Eastern);
        var abbr = Eastern == TimeZoneInfo.Utc ? "UTC" : Eastern.IsDaylightSavingTime(et) ? "EDT" : "EST";
        return $"{et:ddd, MMM d} at {et:h:mm tt} {abbr}";
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
