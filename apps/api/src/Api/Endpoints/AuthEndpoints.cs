using System.Security.Claims;
using ImsaFantasy.Api.Auth;
using ImsaFantasy.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth").WithTags("Auth");

        // Begin Google sign-in (redirects to Google). 503 if Google isn't configured.
        group.MapGet("/login", async (string? returnUrl, IAuthenticationSchemeProvider schemes) =>
        {
            if (await schemes.GetSchemeAsync(AuthSetup.GoogleScheme) is null)
                return Results.Problem("Google sign-in is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            return Results.Challenge(new AuthenticationProperties { RedirectUri = returnUrl ?? "/" }, [AuthSetup.GoogleScheme]);
        });

        group.MapGet("/me", async (HttpContext http, FantasyDbContext db, AdminSubjects admins) =>
        {
            var uid = http.User.GetUserId();
            if (uid is null) return Results.Unauthorized();
            var user = await db.Users.FindAsync(uid.Value);
            if (user is null) return Results.Unauthorized();

            var registrations = await db.Registrations.Where(r => r.UserId == uid)
                .Select(r => new AuthMeRegistration(r.Id, r.SeasonId, r.TeamName)).ToListAsync();
            // name/email are returned only to the account holder (ADR-0004 amendment).
            // isAdmin lets the SPA gate the admin console; the server still enforces the "Admin" policy.
            return Results.Ok(new AuthMeResponse(user.Id, user.ExternalProvider, user.Name, user.Email, http.User.IsAdmin(admins), registrations));
        }).RequireAuthorization().Produces<AuthMeResponse>();

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
}

public record AuthMeResponse(long UserId, string Provider, string? Name, string? Email, bool IsAdmin, List<AuthMeRegistration> Registrations);
public record AuthMeRegistration(long Id, long SeasonId, string TeamName);
public record DevLoginResponse(long UserId);
