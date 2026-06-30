using ImsaFantasy.Api.Email;
using ImsaFantasy.Infrastructure;

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
                ? "You've been unsubscribed from Endurance Fantasy pick reminders."
                : "This unsubscribe link is invalid."), "text/html");
        });

        return app;
    }

    private static async Task<bool> Unsubscribe(string? token, UnsubscribeTokenService tokens, FantasyDbContext db)
    {
        if (!tokens.TryValidate(token, out var userId)) return false;
        var user = await db.Users.FindAsync(userId);
        if (user is null) return false;
        if (user.EmailRemindersEnabled)
        {
            user.EmailRemindersEnabled = false;
            await db.SaveChangesAsync();
        }
        return true; // idempotent — already-off is still a success
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
