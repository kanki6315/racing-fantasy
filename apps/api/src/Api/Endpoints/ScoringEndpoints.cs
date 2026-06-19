using ImsaFantasy.Api.Scoring;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Trigger scoring for a round and read the per-pick breakdown. Scoring is idempotent and runs
/// whatever sources have data + an active ruleset, so the same endpoint serves both phases
/// (after qualifying, then again after the race). Eventually invoked off a results.published
/// event (ADR-0003); exposed manually here.
/// </summary>
public static class ScoringEndpoints
{
    public static IEndpointRouteBuilder MapScoringEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/rounds/{roundId:long}/score", async (long roundId, ScoringService scoring) =>
        {
            var result = await scoring.ScoreRoundAsync(roundId);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).WithTags("Scoring").RequireAuthorization("Admin").Produces<ScoreRoundResult>();

        app.MapGet("/rounds/{roundId:long}/scores", async (long roundId, FantasyDbContext db) =>
        {
            if (!await db.Rounds.AnyAsync(r => r.Id == roundId)) return Results.NotFound();

            var rosters = await db.Rosters.Where(r => r.RoundId == roundId)
                .Include(r => r.Picks)
                .Include(r => r.Modifiers).ThenInclude(m => m.TargetPick)
                .ToListAsync();
            var pickIds = rosters.SelectMany(r => r.Picks).Select(p => p.Id).ToList();
            var modifierIds = rosters.SelectMany(r => r.Modifiers).Select(m => m.Id).ToList();
            var scores = await db.Scores.Where(s =>
                    (s.PickId != null && pickIds.Contains(s.PickId.Value)) ||
                    (s.RosterModifierId != null && modifierIds.Contains(s.RosterModifierId.Value)))
                .ToListAsync();
            var scoresByPick = scores.Where(s => s.PickId != null)
                .GroupBy(s => s.PickId!.Value).ToDictionary(g => g.Key, g => g.ToList());
            var scoresByModifier = scores.Where(s => s.RosterModifierId != null)
                .GroupBy(s => s.RosterModifierId!.Value).ToDictionary(g => g.Key, g => g.ToList());
            var totals = (await db.RoundTotals.Where(rt => rt.RoundId == roundId).ToListAsync())
                .ToDictionary(rt => rt.RegistrationId, rt => rt.Points);

            var registrations = rosters.Select(r => new RegistrationScoreDto(
                r.RegistrationId,
                totals.GetValueOrDefault(r.RegistrationId, 0m),
                r.Picks.Select(p => new PickScoreDto(
                    p.Id, p.SlotType, p.EntityType, p.EntityId, p.ClassId,
                    (scoresByPick.GetValueOrDefault(p.Id) ?? new List<Score>())
                        .Select(s => new SourceScoreDto(s.Source, s.Points, s.RuleVersion)).ToList()))
                    .ToList(),
                r.Modifiers.Select(m => new ModifierScoreDto(
                    m.Id, m.Kind,
                    m.TargetPick is { } tp ? new EntityRef(tp.EntityType.ToString(), tp.EntityId) : null,
                    (scoresByModifier.GetValueOrDefault(m.Id) ?? new List<Score>())
                        .Select(s => new SourceScoreDto(s.Source, s.Points, s.RuleVersion)).ToList()))
                    .ToList()))
                .OrderByDescending(r => r.Total)
                .ToList();

            return Results.Ok(new ScoresResponse(roundId, registrations));
        }).WithTags("Scoring").RequireAuthorization("Admin").Produces<ScoresResponse>();

        return app;
    }
}

public record ScoresResponse(long RoundId, List<RegistrationScoreDto> Registrations);

public record SourceScoreDto(ScoringSource Source, decimal Points, int RuleVersion);
public record PickScoreDto(long PickId, SlotType SlotType, EntityType EntityType, long EntityId, long ClassId, List<SourceScoreDto> Scores);
public record ModifierScoreDto(long ModifierId, string Kind, EntityRef? Target, List<SourceScoreDto> Scores);
public record RegistrationScoreDto(long RegistrationId, decimal Total, List<PickScoreDto> Picks, List<ModifierScoreDto> Modifiers);
