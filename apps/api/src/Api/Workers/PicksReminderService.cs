using EnduranceFantasy.Api.Email;
using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Workers;

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
        // weekend's close (ADR-0009). PicksOpen is due for any open, not-yet-locked event; PicksClosing
        // additionally requires being within HoursBeforeClose of that close (ADR-0009 amendment).
        var open = await db.Events
            .Where(e => e.PicksOpen)
            .Select(e => new { e.Id, e.Name, e.PicksOpenedAt, Close = e.Rounds.Min(r => (DateTime?)r.QualiStart) })
            .ToListAsync(ct);

        foreach (var ev in open)
        {
            if (ev.Close is not { } close || now >= close) continue; // no rounds, or already locked

            var kinds = new List<string>();
            // PicksOpen only within a fresh window after opening — never stale (ADR-0009 amendment).
            if (ev.PicksOpenedAt is { } openedAt && now < openedAt.AddHours(options.PicksOpenWindowHours))
                kinds.Add(ReminderKind.PicksOpen);
            if (now >= close.AddHours(-options.HoursBeforeClose)) kinds.Add(ReminderKind.PicksClosing);
            if (kinds.Count == 0) continue;

            foreach (var kind in kinds)
            {
                // Recipients: users opted into THIS kind, not suppressed, registered for a season racing
                // this weekend, not already sent this (event, kind). One row per user across championships.
                var recipients = await db.Registrations
                    .Where(r => r.UserId != null
                        && r.User!.EmailSuppressedAt == null            // bounce/complaint suppression (ADR-0010)
                        && r.User.Email != null
                        && r.Season.Rounds.Any(rd => rd.EventId == ev.Id)
                        && db.EmailPreferences.Any(p => p.UserId == r.UserId && p.Kind == kind && p.Enabled)
                        && !db.EventReminders.Any(er => er.EventId == ev.Id && er.UserId == r.UserId && er.Kind == kind))
                    .Select(r => new { UserId = r.UserId!.Value, Email = r.User!.Email! })
                    .Distinct()
                    .ToListAsync(ct);

                if (recipients.Count == 0) continue;

                var subject = ReminderEmail.Subject(kind, ev.Name);
                var sent = 0;
                foreach (var rec in recipients)
                {
                    if (ct.IsCancellationRequested) break;
                    if (await TrySendAsync(db, ev.Id, kind, ev.Name, close, rec.UserId, rec.Email, subject, ct)) sent++;
                }
                logger.LogInformation("Picks-reminder: event {Event} kind {Kind} — sent {Sent}/{Total}.", ev.Id, kind, sent, recipients.Count);
            }
        }
    }

    /// <summary>Claim-then-send: insert the claim row first (the unique index rejects a concurrent or
    /// repeat claim → skip), then send; on send failure, remove the claim so the next tick retries.</summary>
    private async Task<bool> TrySendAsync(
        FantasyDbContext db, long eventId, string kind, string eventName, DateTime closeUtc,
        long userId, string email, string subject, CancellationToken ct)
    {
        var claim = new EventReminder { EventId = eventId, UserId = userId, Kind = kind, SentAt = DateTime.UtcNow };
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
            // The unsubscribe token carries the kind, so the link disables only this email (ADR-0009 amendment).
            var unsubscribeUrl = $"{options.ApiBaseUrl}/email/unsubscribe?token={tokens.Create(userId, kind)}";
            var model = new ReminderEmailModel(eventName, closeUtc, options.WebBaseUrl!, unsubscribeUrl);
            var body = ReminderEmail.RenderHtml(kind, model);
            var messageId = await sender.SendAsync(new EmailMessage(email, subject, body, unsubscribeUrl), ct);
            if (messageId is null) throw new InvalidOperationException("email sender reported not-sent");
            claim.SesMessageId = messageId;          // correlate future bounce/complaint to this send (ADR-0010)
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Reminder send failed (user {User}, event {Event}, kind {Kind}); rolling back claim to retry.", userId, eventId, kind);
            db.EventReminders.Remove(claim);
            await db.SaveChangesAsync(CancellationToken.None);
            return false;
        }
    }
}
