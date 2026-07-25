using System.Security.Claims;
using EnduranceFantasy.Api.Auth;
using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth").WithTags("Auth");

        // Begin Google sign-in (redirects to Google). 503 if Google isn't configured.
        group.MapGet("/login", async (string? returnUrl, IAuthenticationSchemeProvider schemes, IConfiguration config, IWebHostEnvironment env) =>
        {
            if (await schemes.GetSchemeAsync(AuthSetup.GoogleScheme) is null)
                return Results.Problem("Google sign-in is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            // Only honour a returnUrl that points back at our own web origin (open-redirect guard).
            var redirect = SafeReturnUrl(returnUrl, config["Web:Origin"], env.IsDevelopment()) ?? "/";
            return Results.Challenge(new AuthenticationProperties { RedirectUri = redirect }, [AuthSetup.GoogleScheme]);
        });

        group.MapGet("/me", async (HttpContext http, FantasyDbContext db, AdminSubjects admins) =>
        {
            var uid = http.User.GetUserId();
            if (uid is null) return Results.Unauthorized();
            var user = await db.Users.FindAsync(uid.Value);
            if (user is null) return Results.Unauthorized();

            var registrations = await db.Registrations.Where(r => r.UserId == uid)
                .Select(r => new AuthMeRegistration(r.Id, r.SeasonId, r.TeamName)).ToListAsync();
            // Resolve every email kind (default false when there's no row) so the client renders both toggles.
            var prefRows = await db.EmailPreferences.Where(p => p.UserId == uid).ToListAsync();
            var prefs = ReminderKind.All
                .Select(k => new EmailPreferenceDto(k, prefRows.FirstOrDefault(p => p.Kind == k)?.Enabled ?? false)).ToList();
            // name/email are returned only to the account holder (ADR-0004 amendment).
            // isAdmin lets the SPA gate the admin console; the server still enforces the "Admin" policy.
            return Results.Ok(new AuthMeResponse(user.Id, user.ExternalProvider, user.Name, user.Email, http.User.IsAdmin(admins), prefs, registrations));
        }).RequireAuthorization().Produces<AuthMeResponse>();

        // Per-kind account toggle for picks-reminder emails (ADR-0009 amendment). Upserts one preference.
        // The one-click unsubscribe link in the email is a separate, auth-free endpoint (/email/unsubscribe).
        group.MapPut("/me/email-preferences", async (UpdateEmailPreference dto, HttpContext http, FantasyDbContext db) =>
        {
            var uid = http.User.GetUserId();
            if (uid is null) return Results.Unauthorized();
            if (!ReminderKind.IsValid(dto.Kind))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["kind"] = ["Unknown email kind."] });
            if (!await db.Users.AnyAsync(u => u.Id == uid)) return Results.Unauthorized();

            var pref = await db.EmailPreferences.FirstOrDefaultAsync(p => p.UserId == uid && p.Kind == dto.Kind);
            if (pref is null)
                db.EmailPreferences.Add(new EmailPreference { UserId = uid.Value, Kind = dto.Kind, Enabled = dto.Enabled, UpdatedAt = DateTime.UtcNow });
            else
                (pref.Enabled, pref.UpdatedAt) = (dto.Enabled, DateTime.UtcNow);
            await db.SaveChangesAsync();
            return Results.Ok(new EmailPreferenceDto(dto.Kind, dto.Enabled));
        }).RequireAuthorization().RequireRateLimiting("email-prefs").Produces<EmailPreferenceDto>();

        group.MapPost("/logout", async (HttpContext http) =>
        {
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok();
        });

        // Development-only: issue a session cookie without Google, so auth-dependent flows are testable.
        // Optional name/email mirror the real Google claim shape (ADR-0004 amendment); defaults synthesized.
        group.MapPost("/dev-login", async (string? subject, string? name, string? email, HttpContext http, FantasyDbContext db, IWebHostEnvironment env) =>
        {
            if (!env.IsDevelopment()) return Results.NotFound();
            subject ??= "dev-user";
            name ??= subject;
            email ??= $"{subject}@dev.local";

            var user = await db.Users.FirstOrDefaultAsync(u => u.ExternalProvider == AuthSetup.Provider && u.ExternalSubject == subject);
            if (user is null)
            {
                user = new Domain.AppUser { ExternalProvider = AuthSetup.Provider, ExternalSubject = subject, Name = name, Email = email, CreatedAt = DateTime.UtcNow };
                db.Add(user);
                await db.SaveChangesAsync();
            }
            else if (name != user.Name || email != user.Email)
            {
                user.Name = name;
                user.Email = email;
                await db.SaveChangesAsync();
            }

            var identity = new ClaimsIdentity(CookieAuthenticationDefaults.AuthenticationScheme);
            identity.AddClaim(new Claim("uid", user.Id.ToString()));
            identity.AddClaim(new Claim("sub", subject));
            await http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
            return Results.Ok(new DevLoginResponse(user.Id));
        }).Produces<DevLoginResponse>();

        return app;
    }

    /// <summary>
    /// Validates a post-login returnUrl against an allowlist to prevent open redirects: same-app
    /// relative paths are fine, absolute URLs must match the configured web origin, and in dev we
    /// also allow localhost so the SPA on :5173 still gets the redirect back. Returns null if unsafe.
    /// </summary>
    private static string? SafeReturnUrl(string? url, string? webOrigin, bool isDev)
    {
        if (string.IsNullOrEmpty(url)) return null;
        // Relative same-app path — allow, but reject protocol-relative "//evil.com".
        if (url.StartsWith('/') && !url.StartsWith("//")) return url;
        if (!string.IsNullOrEmpty(webOrigin) &&
            (url == webOrigin || url.StartsWith(webOrigin + "/", StringComparison.Ordinal)))
            return url;
        if (isDev && (url.StartsWith("http://localhost:", StringComparison.Ordinal)
                   || url.StartsWith("http://127.0.0.1:", StringComparison.Ordinal)))
            return url;
        return null;
    }
}

public record AuthMeResponse(long UserId, string Provider, string? Name, string? Email, bool IsAdmin, List<EmailPreferenceDto> EmailPreferences, List<AuthMeRegistration> Registrations);
public record AuthMeRegistration(long Id, long SeasonId, string TeamName);
public record EmailPreferenceDto(string Kind, bool Enabled);
public record UpdateEmailPreference(string Kind, bool Enabled);
public record DevLoginResponse(long UserId);
public record UpdateEmailReminders(bool Enabled);
public record EmailRemindersResponse(bool EmailRemindersEnabled);
