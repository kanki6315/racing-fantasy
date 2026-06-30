using ImsaFantasy.Api.Email;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Workers;

/// <summary>
/// Sends one opt-in picks-reminder email per race weekend (ADR-0009). Mirrors LockSweepService: a
/// PeriodicTimer poll + scoped DbContext, idempotent and safe to miss/double-fire. The firing rule
/// (at-open vs N-hours-before-close) is config (D2); single-send is guaranteed by the event_reminder
/// claim row's unique (event_id, user_id) index (D3). Idle unless enabled AND SES + links are
/// configured — so the app runs cleanly before reminders are provisioned.
/// </summary>
public sealed class PicksReminderService(
    IServiceProvider services,
    ReminderOptions options,
    SesOptions ses,
    UnsubscribeTokenService tokens,
    IEmailSender sender,
    ILogger<PicksReminderService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!Ready()) return; // logged in Ready(); nothing to do until configured

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(30, options.PollSeconds)));
        do
        {
            try { await TickAsync(ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Picks-reminder tick failed; will retry next interval."); }
        } while (await timer.WaitForNextTickAsync(ct));
    }

    private bool Ready()
    {
        if (!options.Enabled) { logger.LogInformation("Picks-reminder worker disabled (Reminders:Enabled=false)."); return false; }
        var missing = new List<string>();
        if (!ses.IsConfigured) missing.Add("Aws:Ses");
        if (!tokens.IsConfigured) missing.Add("Reminders:UnsubscribeSecret");
        if (string.IsNullOrWhiteSpace(options.WebBaseUrl)) missing.Add("Reminders:WebBaseUrl");
        if (string.IsNullOrWhiteSpace(options.ApiBaseUrl)) missing.Add("Reminders:ApiBaseUrl");
        if (missing.Count > 0)
        {
            logger.LogWarning("Picks-reminder worker enabled but idle — missing config: {Missing}.", string.Join(", ", missing));
            return false;
        }
        logger.LogInformation("Picks-reminder worker started: {Hours}h before close, poll={Poll}s.", options.HoursBeforeClose, options.PollSeconds);
        return true;
    }

    private async Task TickAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FantasyDbContext>();

        // Candidate events: pick board released, with at least one round. Earliest quali_start is the
        // weekend's close (ADR-0009 — one email per event, beating the first deadline). Due once we're
        // within HoursBeforeClose of that close and it hasn't locked yet.
        var open = await db.Events
            .Where(e => e.PicksOpen)
            .Select(e => new { e.Id, e.Name, Close = e.Rounds.Min(r => (DateTime?)r.QualiStart) })
            .ToListAsync(ct);

        var due = open.Where(e => e.Close is { } close
                && now < close                                   // not yet locked
                && now >= close.AddHours(-options.HoursBeforeClose)) // within the lead window
            .ToList();

        foreach (var ev in due)
        {
            // Recipients: opted-in users registered for a season racing this weekend, with an email,
            // not already sent for this event. One row per user even across multiple championships.
            var recipients = await db.Registrations
                .Where(r => r.UserId != null
                    && r.User!.EmailRemindersEnabled
                    && r.User.Email != null
                    && r.Season.Rounds.Any(rd => rd.EventId == ev.Id)
                    && !db.EventReminders.Any(er => er.EventId == ev.Id && er.UserId == r.UserId))
                .Select(r => new { UserId = r.UserId!.Value, Email = r.User!.Email! })
                .Distinct()
                .ToListAsync(ct);

            if (recipients.Count == 0) continue;

            var subject = ReminderEmail.Subject(ev.Name);
            var sent = 0;
            foreach (var rec in recipients)
            {
                if (ct.IsCancellationRequested) break;
                if (await TrySendAsync(db, ev.Id, ev.Name, ev.Close!.Value, rec.UserId, rec.Email, subject, ct)) sent++;
            }
            logger.LogInformation("Picks-reminder: event {Event} — sent {Sent}/{Total}.", ev.Id, sent, recipients.Count);
        }
    }

    /// <summary>Claim-then-send: insert the claim row first (the unique index rejects a concurrent or
    /// repeat claim → skip), then send; on send failure, remove the claim so the next tick retries.</summary>
    private async Task<bool> TrySendAsync(
        FantasyDbContext db, long eventId, string eventName, DateTime closeUtc,
        long userId, string email, string subject, CancellationToken ct)
    {
        var claim = new EventReminder { EventId = eventId, UserId = userId, SentAt = DateTime.UtcNow };
        db.EventReminders.Add(claim);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            db.Entry(claim).State = EntityState.Detached; // already claimed (unique violation) — skip
            return false;
        }

        try
        {
            var unsubscribeUrl = $"{options.ApiBaseUrl}/email/unsubscribe?token={tokens.Create(userId)}";
            var model = new ReminderEmailModel(eventName, closeUtc, options.WebBaseUrl!, unsubscribeUrl);
            var body = ReminderEmail.RenderHtml(model);
            var ok = await sender.SendAsync(new EmailMessage(email, subject, body, unsubscribeUrl), ct);
            if (!ok) throw new InvalidOperationException("email sender reported not-sent");
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Reminder send failed (user {User}, event {Event}); rolling back claim to retry.", userId, eventId);
            db.EventReminders.Remove(claim);
            await db.SaveChangesAsync(CancellationToken.None);
            return false;
        }
    }
}
