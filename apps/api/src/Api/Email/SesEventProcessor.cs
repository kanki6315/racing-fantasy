using System.Text.Json;
using Amazon.SimpleNotificationService.Util;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Email;

/// <summary>
/// Ingests SES bounce/complaint events delivered via SNS (ADR-0010). Verifies the SNS signature and
/// topic before acting, auto-confirms the subscription, records each event in <c>email_event</c>, and
/// stamps <see cref="AppUser.EmailSuppressedAt"/> on a permanent bounce or any complaint. Idempotent:
/// redelivery hits the unique (sns_message_id, email) index and is skipped.
/// </summary>
public sealed class SesEventProcessor(FantasyDbContext db, SesOptions ses, ILogger<SesEventProcessor> log)
{
    private static readonly HttpClient Http = new();

    /// <summary>Handles a raw SNS POST body (signature-verified). Returns the HTTP result for the endpoint.</summary>
    public async Task<IResult> HandleAsync(string body, CancellationToken ct)
    {
        Message msg;
        try { msg = Message.ParseMessage(body); }
        catch (Exception ex) { log.LogWarning(ex, "SES events: unparseable SNS message."); return Results.BadRequest(); }

        if (!msg.IsMessageSignatureValid())
        {
            log.LogWarning("SES events: invalid SNS signature — rejected.");
            return Results.Unauthorized();
        }
        if (!string.IsNullOrWhiteSpace(ses.EventsTopicArn) &&
            !string.Equals(msg.TopicArn, ses.EventsTopicArn, StringComparison.Ordinal))
        {
            log.LogWarning("SES events: message from unexpected topic {Topic} — rejected.", msg.TopicArn);
            return Results.Unauthorized();
        }

        switch (msg.Type)
        {
            case "SubscriptionConfirmation":
                await Http.GetAsync(msg.SubscribeURL, ct); // visiting the URL confirms the subscription
                log.LogInformation("SES events: confirmed SNS subscription to {Topic}.", msg.TopicArn);
                return Results.Ok();
            case "Notification":
                await RecordAsync(msg.MessageText, msg.MessageId, ct);
                return Results.Ok();
            default:
                return Results.Ok(); // UnsubscribeConfirmation etc. — nothing to do
        }
    }

    /// <summary>Parses one SES event JSON, records it, and suppresses where warranted. Public so the
    /// Development-only simulate endpoint can exercise it without an SNS envelope.</summary>
    public async Task RecordAsync(string sesEventJson, string? snsMessageId, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(sesEventJson);
        var root = doc.RootElement;
        var type = root.TryGetProperty("eventType", out var et) ? et.GetString()
                 : root.TryGetProperty("notificationType", out var nt) ? nt.GetString() : null;
        if (type is not ("Bounce" or "Complaint")) return; // deliveries, opens, etc. — ignored

        var sesMessageId = root.TryGetProperty("mail", out var mail) && mail.TryGetProperty("messageId", out var mid)
            ? mid.GetString() : null;
        var (subtype, suppress, recipients) = type == "Bounce" ? ParseBounce(root) : ParseComplaint(root);

        var now = DateTime.UtcNow;
        foreach (var email in recipients)
        {
            var userId = await db.Users.Where(u => u.Email == email).Select(u => (long?)u.Id).FirstOrDefaultAsync(ct);
            db.EmailEvents.Add(new EmailEvent
            {
                Type = type, Subtype = subtype, Email = email, UserId = userId,
                SesMessageId = sesMessageId, SnsMessageId = snsMessageId, Raw = sesEventJson, ReceivedAt = now,
            });
            if (suppress)
            {
                var users = await db.Users.Where(u => u.Email == email && u.EmailSuppressedAt == null).ToListAsync(ct);
                foreach (var u in users) u.EmailSuppressedAt = now;
            }
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { db.ChangeTracker.Clear(); } // duplicate (sns_message_id,email) — already handled
        }
        log.LogInformation("SES events: {Type} recorded for {Count} recipient(s){Suppressed}.",
            type, recipients.Count, suppress ? " — suppressed" : "");
    }

    private static (string? subtype, bool suppress, List<string> recipients) ParseBounce(JsonElement root)
    {
        var b = root.GetProperty("bounce");
        var bounceType = b.TryGetProperty("bounceType", out var bt) ? bt.GetString() : null;
        var bounceSub = b.TryGetProperty("bounceSubType", out var bs) ? bs.GetString() : null;
        // Only permanent bounces suppress; transient (soft) bounces are recorded but not suppressed (ADR-0010 D4).
        return ($"{bounceType}/{bounceSub}",
            string.Equals(bounceType, "Permanent", StringComparison.OrdinalIgnoreCase),
            Recipients(b, "bouncedRecipients"));
    }

    private static (string? subtype, bool suppress, List<string> recipients) ParseComplaint(JsonElement root)
    {
        var c = root.GetProperty("complaint");
        var fbType = c.TryGetProperty("complaintFeedbackType", out var ft) ? ft.GetString() : "complaint";
        return (fbType, true, Recipients(c, "complainedRecipients")); // complaints always suppress
    }

    private static List<string> Recipients(JsonElement parent, string arrayName)
    {
        var list = new List<string>();
        if (parent.TryGetProperty(arrayName, out var arr) && arr.ValueKind == JsonValueKind.Array)
            foreach (var r in arr.EnumerateArray())
                if (r.TryGetProperty("emailAddress", out var ea) && ea.GetString() is { } e) list.Add(e);
        return list;
    }
}
