using ImsaFantasy.Api.Email;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Public email-management endpoints (ADR-0009 D7). Unsubscribe is auth-free — the signed token in the
/// link is what authorizes the change — so it works straight from a mail client. POST is the one-click
/// target for the List-Unsubscribe-Post header (RFC 8058); GET serves a human a confirmation page.
/// </summary>
public static class EmailEndpoints
{
    public static IEndpointRouteBuilder MapEmailEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/email").WithTags("Email").AllowAnonymous();

        group.MapPost("/unsubscribe", async (string? token, UnsubscribeTokenService tokens, FantasyDbContext db) =>
            await Unsubscribe(token, tokens, db) ? Results.Ok() : Results.BadRequest());

        group.MapGet("/unsubscribe", async (string? token, UnsubscribeTokenService tokens, FantasyDbContext db) =>
        {
            var ok = await Unsubscribe(token, tokens, db);
            return Results.Content(Page(ok
                ? "You've been unsubscribed from this Endurance Fantasy email. You can manage the rest from your dashboard."
                : "This unsubscribe link is invalid."), "text/html");
        });

        // SES bounce/complaint events via SNS (ADR-0010). SNS posts text/plain, so read the raw body;
        // the processor verifies the signature + topic before acting.
        group.MapPost("/ses-events", async (HttpRequest request, SesEventProcessor processor, CancellationToken ct) =>
        {
            using var reader = new StreamReader(request.Body);
            return await processor.HandleAsync(await reader.ReadToEndAsync(ct), ct);
        });

        // Development-only: feed a raw SES event JSON straight into the processor (no SNS envelope /
        // signature) to exercise record + suppression locally. Mirrors the dev-login shortcut.
        group.MapPost("/ses-events/dev-simulate", async (HttpRequest request, SesEventProcessor processor, IWebHostEnvironment env, CancellationToken ct) =>
        {
            if (!env.IsDevelopment()) return Results.NotFound();
            using var reader = new StreamReader(request.Body);
            await processor.RecordAsync(await reader.ReadToEndAsync(ct), $"dev-{Guid.NewGuid()}", ct);
            return Results.Ok();
        });

        return app;
    }

    // Disables just the one email kind the link was issued for (ADR-0009 amendment). Upserts the
    // preference row off so an unsubscribe before the user ever toggled is still recorded.
    private static async Task<bool> Unsubscribe(string? token, UnsubscribeTokenService tokens, FantasyDbContext db)
    {
        if (!tokens.TryValidate(token, out var userId, out var kind) || !ReminderKind.IsValid(kind)) return false;
        if (!await db.Users.AnyAsync(u => u.Id == userId)) return false;

        var pref = await db.EmailPreferences.FirstOrDefaultAsync(p => p.UserId == userId && p.Kind == kind);
        if (pref is null)
            db.EmailPreferences.Add(new EmailPreference { UserId = userId, Kind = kind, Enabled = false, UpdatedAt = DateTime.UtcNow });
        else if (pref.Enabled)
            (pref.Enabled, pref.UpdatedAt) = (false, DateTime.UtcNow);
        else
            return true; // already off — idempotent

        await db.SaveChangesAsync();
        return true;
    }

    // Static copy only (no token echoed), so no injection surface. On-brand near-black confirmation page.
    private static string Page(string message) => $"""
        <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Endurance Fantasy</title></head>
        <body style="margin:0;background:#0a0b0d;color:#c8ccd2;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:480px;margin:64px auto;padding:0 24px;">
            <div style="font-size:13px;letter-spacing:2px;color:#c8ccd2;font-weight:bold;">ENDURANCE <span style="color:#e10600;">FANTASY</span></div>
            <p style="font-size:16px;line-height:24px;margin-top:24px;">{message}</p>
          </div>
        </body></html>
        """;
}
