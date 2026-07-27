using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using EnduranceFantasy.Api.Auth;
using EnduranceFantasy.Api.Common;
using EnduranceFantasy.Api.Email;
using EnduranceFantasy.Api.Endpoints;
using EnduranceFantasy.Api.Images;
using EnduranceFantasy.Api.Parsing;
using EnduranceFantasy.Api.Workers;
using EnduranceFantasy.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Title the document explicitly. Left to itself, AddOpenApi() names the doc after the assembly, so
// the API advertised its project name ("ImsaFantasy.Api") to every consumer — and would quietly
// re-leak whatever the assembly is called next time it gets renamed.
builder.Services.AddOpenApi(o => o.AddDocumentTransformer((doc, _, _) =>
{
    doc.Info.Title = "Endurance Fantasy API";
    return Task.CompletedTask;
}));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemExceptionHandler>();
builder.Services.AddMemoryCache();
builder.Services.AddHostedService<LockSweepService>();
builder.Services.AddScoped<EnduranceFantasy.Api.Scoring.ScoringService>();
builder.Services.AddAuth(builder.Configuration);
builder.Services.AddImageStorage(builder.Configuration);
builder.Services.AddEntryListParser(builder.Configuration);

// Picks-reminder emails (ADR-0009): config-bound options. The SES sender + worker are registered
// below; both no-op until configured/enabled.
var reminderOptions = builder.Configuration.GetSection("Reminders").Get<ReminderOptions>() ?? new ReminderOptions();
// The email CTA links to the player web app; default to the existing Web:Origin so it needn't be set twice.
reminderOptions.WebBaseUrl ??= builder.Configuration["Web:Origin"];
builder.Services.AddSingleton(reminderOptions);
builder.Services.AddSingleton(
    builder.Configuration.GetSection("Aws:Ses").Get<EnduranceFantasy.Api.Email.SesOptions>() ?? new EnduranceFantasy.Api.Email.SesOptions());
builder.Services.AddEmail();
builder.Services.AddSingleton<UnsubscribeTokenService>();
builder.Services.AddScoped<EnduranceFantasy.Api.Email.SesEventProcessor>();
builder.Services.AddHostedService<PicksReminderService>();

// Rate-limit the email-preference toggle so it can't be hammered (ADR-0009). Per-user fixed window;
// 5 changes/min is far above any human use but blocks scripted spam. Toggling never causes email
// spam (the worker's per-event claim row prevents resends) — this just protects the endpoint.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("email-prefs", http => RateLimitPartition.GetFixedWindowLimiter(
        http.User.GetUserId()?.ToString() ?? http.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

// CORS: in prod the SPA lives on a different origin (fantasy.* → fantasyapi.*), so it needs an
// explicit credentialed allowlist to send the session cookie. In dev the Vite proxy makes the
// browser same-origin, so Web:Origin is unset and CORS is skipped entirely.
var webOrigin = builder.Configuration["Web:Origin"];
if (!string.IsNullOrEmpty(webOrigin))
{
    builder.Services.AddCors(o => o.AddPolicy("web", p => p
        .WithOrigins(webOrigin)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));
}

// Behind Railway's TLS-terminating proxy the app sees plain HTTP; trust the X-Forwarded-* headers
// so HTTPS redirect, secure-cookie emission, and the OIDC redirect_uri are built from the real
// external scheme/host. The proxy IP isn't fixed, so clear the known-proxy allowlist.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddInfrastructure(
    builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Missing connection string 'Postgres'."));

var app = builder.Build();

// Must run before anything that inspects the request scheme/host (HTTPS redirect, auth, OIDC).
app.UseForwardedHeaders();

// Apply pending EF migrations on boot so a fresh/updated DB is schema-current without a manual
// step. NOTE: a broken migration will fail startup and take the API down — test migrations against
// a throwaway DB copy first (see docs/infra/deploy.md).
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<FantasyDbContext>().Database.Migrate();
}

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

if (!string.IsNullOrEmpty(webOrigin))
{
    app.UseCors("web");
}

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter(); // after auth so policies can partition by the resolved user

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).WithTags("Meta");

app.MapAuthEndpoints();

app.MapChampionshipEndpoints();
app.MapSeasonEndpoints();
app.MapClassEndpoints();
app.MapEventEndpoints();
app.MapRoundEndpoints();
app.MapSessionEndpoints();
app.MapDriverEndpoints();
app.MapCarEntryEndpoints();
app.MapEntryDriverEndpoints();
app.MapEntryListEndpoints();
app.MapEntryListImportEndpoints();
app.MapRosterRuleEndpoints();
app.MapRosterModifierRuleEndpoints();
app.MapUserEndpoints();
app.MapRegistrationEndpoints();
app.MapPriceEndpoints();
app.MapRosterEndpoints();
app.MapIngestionEndpoints();
app.MapScoringRulesetEndpoints();
app.MapScoringEndpoints();
app.MapLeaderboardEndpoints();
app.MapLeagueEndpoints();
app.MapImageEndpoints();
app.MapStatsEndpoints();
app.MapRoundStatsEndpoints();
app.MapEmailEndpoints();

app.Run();
