using System.Text.Json.Serialization;
using ImsaFantasy.Api.Auth;
using ImsaFantasy.Api.Common;
using ImsaFantasy.Api.Endpoints;
using ImsaFantasy.Api.Images;
using ImsaFantasy.Api.Workers;
using ImsaFantasy.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemExceptionHandler>();
builder.Services.AddMemoryCache();
builder.Services.AddHostedService<LockSweepService>();
builder.Services.AddScoped<ImsaFantasy.Api.Scoring.ScoringService>();
builder.Services.AddImsaAuth(builder.Configuration);
builder.Services.AddImageStorage(builder.Configuration);
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddInfrastructure(
    builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Missing connection string 'Postgres'."));

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).WithTags("Meta");

app.MapAuthEndpoints();

app.MapChampionshipEndpoints();
app.MapSeasonEndpoints();
app.MapClassEndpoints();
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

app.Run();
