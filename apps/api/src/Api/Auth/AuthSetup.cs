using System.Security.Claims;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Auth;

/// <summary>
/// Authentication wiring (ADR-0004, amended 2026-06-17): a session cookie plus Google OIDC. We
/// request `openid email profile` and read name/email from the id_token (no userinfo round-trip,
/// no stored tokens). First login creates the AppUser and stamps its name/email; later logins
/// refresh them. Name/email are private profile data — the public leaderboard label is still the
/// per-registration team name.
/// </summary>
public static class AuthSetup
{
    public const string GoogleScheme = "Google";
    public const string Provider = "google";

    public static IServiceCollection AddImsaAuth(this IServiceCollection services, IConfiguration config)
    {
        var clientId = config["Authentication:Google:ClientId"];
        var clientSecret = config["Authentication:Google:ClientSecret"];

        var auth = services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(o =>
            {
                o.Cookie.Name = "endurance.session";
                o.Cookie.SameSite = SameSiteMode.Lax;
                o.Cookie.HttpOnly = true;
                // Prod runs behind HTTPS (Railway) so the cookie must be Secure. Browsers treat
                // http://localhost as a secure context, so Always still works in local dev.
                o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                o.ExpireTimeSpan = TimeSpan.FromDays(30);
                o.SlidingExpiration = true;
                // It's an API: answer 401/403 rather than redirecting to a login page.
                o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
                o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
            });

        // Only register Google when configured, so the app still runs (and dev-login works) without creds.
        if (!string.IsNullOrEmpty(clientId) && !string.IsNullOrEmpty(clientSecret))
        {
            auth.AddOpenIdConnect(GoogleScheme, o =>
            {
                o.Authority = "https://accounts.google.com";
                o.ClientId = clientId;
                o.ClientSecret = clientSecret;
                o.ResponseType = "code";
                o.CallbackPath = "/auth/google/callback";
                o.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                o.SaveTokens = false;                    // don't persist provider tokens
                o.GetClaimsFromUserInfoEndpoint = false; // id_token only — no userinfo round-trip
                o.MapInboundClaims = false;              // keep the raw `sub`
                o.Scope.Clear();
                o.Scope.Add("openid");
                o.Scope.Add("email");                    // ADR-0004 amendment: collect email…
                o.Scope.Add("profile");                  // …and name, from the id_token
                o.ClaimActions.Clear();                  // map nothing beyond what we add ourselves
                o.TokenValidationParameters.NameClaimType = "sub";
                o.Events = new OpenIdConnectEvents { OnTokenValidated = OnGoogleTokenValidated };
            });
        }

        // Admins are an allowlist of Google subjects in config (no schema change). An empty list
        // means no admins — every admin-gated endpoint returns 403 until one is configured.
        // Registered as a singleton so the "Admin" policy and /auth/me share one source of truth.
        var adminSubjects = new AdminSubjects(config.GetSection("Authentication:AdminSubjects").Get<string[]>() ?? []);
        services.AddSingleton(adminSubjects);
        services.AddAuthorization(options =>
            options.AddPolicy("Admin", policy => policy
                .RequireAuthenticatedUser()
                .RequireAssertion(ctx => ctx.User.IsAdmin(adminSubjects))));

        return services;
    }

    /// <summary>
    /// First login creates the AppUser; subsequent logins resolve it. Name/email are read from the
    /// id_token (ADR-0004 amendment) and refreshed when present, so a changed Google name propagates.
    /// Stamps the internal uid.
    /// </summary>
    private static async Task OnGoogleTokenValidated(TokenValidatedContext ctx)
    {
        var sub = ctx.Principal?.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(sub)) { ctx.Fail("Missing subject."); return; }

        var name = ctx.Principal?.FindFirst("name")?.Value;
        var email = ctx.Principal?.FindFirst("email")?.Value;

        var db = ctx.HttpContext.RequestServices.GetRequiredService<FantasyDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.ExternalProvider == Provider && u.ExternalSubject == sub);
        if (user is null)
        {
            user = new AppUser { ExternalProvider = Provider, ExternalSubject = sub, Name = name, Email = email, CreatedAt = DateTime.UtcNow };
            db.Add(user);
            await db.SaveChangesAsync();
        }
        else if ((name is not null && name != user.Name) || (email is not null && email != user.Email))
        {
            if (name is not null) user.Name = name;
            if (email is not null) user.Email = email;
            await db.SaveChangesAsync();
        }
        ctx.Principal!.Identities.First().AddClaim(new Claim("uid", user.Id.ToString()));
    }

    /// <summary>The internal AppUser id carried in the session cookie, or null if unauthenticated.</summary>
    public static long? GetUserId(this ClaimsPrincipal principal) =>
        long.TryParse(principal.FindFirst("uid")?.Value, out var id) ? id : null;

    /// <summary>True when the principal's Google subject is on the admin allowlist (same check the "Admin" policy uses).</summary>
    public static bool IsAdmin(this ClaimsPrincipal principal, AdminSubjects admins) =>
        principal.FindFirst("sub")?.Value is { } sub && admins.Subjects.Contains(sub);
}

/// <summary>The configured admin Google-subject allowlist, registered as a singleton (see AddImsaAuth).</summary>
public sealed class AdminSubjects(IReadOnlyCollection<string> subjects)
{
    public IReadOnlyCollection<string> Subjects { get; } = subjects;
}
