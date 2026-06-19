using ImsaFantasy.Api.Common;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Authoring of versioned scoring rulesets (ADR-0003). One ruleset per (season, source); creating
/// a new one bumps the version and — when activated — archives the prior active ruleset for that
/// source. The rank → points table is class-relative in ranking, class-agnostic in points.
/// </summary>
public static class ScoringRulesetEndpoints
{
    public static IEndpointRouteBuilder MapScoringRulesetEndpoints(this IEndpointRouteBuilder app)
    {
        var seasonGroup = app.MapGroup("/seasons/{seasonId:long}/scoring-rulesets").WithTags("ScoringRulesets").RequireAuthorization("Admin");

        seasonGroup.MapGet("/", async (long seasonId, ScoringSource? source, FantasyDbContext db) =>
            Results.Ok(await db.ScoringRulesets
                .Where(r => r.SeasonId == seasonId && (source == null || r.Source == source))
                .OrderBy(r => r.Source).ThenByDescending(r => r.Version)
                .Select(r => new RulesetDto(r.Id, r.SeasonId, r.Source, r.Version, r.Status, r.EffectiveFrom))
                .ToListAsync()));

        seasonGroup.MapPost("/", async (long seasonId, CreateRuleset dto, FantasyDbContext db) =>
        {
            if (!await db.Seasons.AnyAsync(s => s.Id == seasonId))
                return ApiResults.RefNotFound("seasonId");
            if (dto.PositionPoints is null || dto.PositionPoints.Count == 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["positionPoints"] = ["At least one rank→points row is required."] });
            if (dto.PositionPoints.Select(p => p.Rank).Distinct().Count() != dto.PositionPoints.Count)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["positionPoints"] = ["Ranks must be unique."] });

            var nextVersion = 1 + await db.ScoringRulesets
                .Where(r => r.SeasonId == seasonId && r.Source == dto.Source)
                .Select(r => (int?)r.Version).MaxAsync() ?? 1;

            var activate = dto.Activate ?? true;
            if (activate)
                await db.ScoringRulesets
                    .Where(r => r.SeasonId == seasonId && r.Source == dto.Source && r.Status == RulesetStatus.Active)
                    .ExecuteUpdateAsync(u => u.SetProperty(r => r.Status, RulesetStatus.Archived));

            var ruleset = new ScoringRuleset
            {
                SeasonId = seasonId,
                Source = dto.Source,
                Version = nextVersion,
                Status = activate ? RulesetStatus.Active : RulesetStatus.Draft,
                EffectiveFrom = DateTime.UtcNow,
                PositionPoints = dto.PositionPoints.Select(p => new PositionPoints { Rank = p.Rank, Points = p.Points }).ToList()
            };
            db.Add(ruleset);
            await db.SaveChangesAsync();

            return Results.Created($"/scoring-rulesets/{ruleset.Id}",
                new RulesetDto(ruleset.Id, ruleset.SeasonId, ruleset.Source, ruleset.Version, ruleset.Status, ruleset.EffectiveFrom));
        });

        app.MapGet("/scoring-rulesets/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var r = await db.ScoringRulesets.Include(x => x.PositionPoints).FirstOrDefaultAsync(x => x.Id == id);
            return r is null
                ? Results.NotFound()
                : Results.Ok(new RulesetDetailDto(r.Id, r.SeasonId, r.Source, r.Version, r.Status, r.EffectiveFrom,
                    r.PositionPoints.OrderBy(p => p.Rank).Select(p => new RankPoints(p.Rank, p.Points)).ToList()));
        }).WithTags("ScoringRulesets").RequireAuthorization("Admin");

        return app;
    }
}

public record RankPoints(int Rank, decimal Points);
public record CreateRuleset(ScoringSource Source, List<RankPoints> PositionPoints, bool? Activate);
public record RulesetDto(long Id, long SeasonId, ScoringSource Source, int Version, RulesetStatus Status, DateTime EffectiveFrom);
public record RulesetDetailDto(long Id, long SeasonId, ScoringSource Source, int Version, RulesetStatus Status, DateTime EffectiveFrom, List<RankPoints> PositionPoints);
