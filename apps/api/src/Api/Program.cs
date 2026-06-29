using System.Text.Json.Serialization;
using ImsaFantasy.Api.Auth;
using ImsaFantasy.Api.Common;
using ImsaFantasy.Api.Endpoints;
using ImsaFantasy.Api.Images;
using ImsaFantasy.Api.Workers;
using ImsaFantasy.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemExceptionHandler>();
builder.Services.AddMemoryCache();
builder.Services.AddHostedService<LockSweepService>();
builder.Services.AddScoped<ImsaFantasy.Api.Scoring.ScoringService>();
builder.Services.AddImsaAuth(builder.Configuration);
builder.Services.AddImageStorage(builder.Configuration);

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

app.Run();
