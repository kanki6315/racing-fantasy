using ImsaFantasy.Domain;

namespace ImsaFantasy.Api.Scoring;

/// <summary>
/// A modifier's score-time behaviour (ADR-0006 D7). Each <see cref="RosterModifier"/> kind plugs in
/// here, so a new modifier is one class, not edits scattered across the scoring service. Handlers
/// only ever *read* a <see cref="RoundScoringContext"/> and *emit* modifier-owned BONUS rows — they
/// never change rules or eligibility (that constraint is what keeps this contract sufficient).
/// </summary>
public interface IModifierScorer
{
    string Kind { get; }
    IEnumerable<BonusScore> Score(RosterModifier modifier, RoundScoringContext ctx);
}

/// <summary>One bonus line a modifier emits. <see cref="RuleVersion"/> is stamped for reproducibility.</summary>
public readonly record struct BonusScore(decimal Points, int RuleVersion);

/// <summary>
/// Read-only view of a round's computed scores, handed to each modifier scorer. Exposes more than the
/// player's own pick scores so the family stays one path: <see cref="BasePoints"/> for pick-targeted
/// kinds today; <c>EntryPoints</c>/attribute lookups (for MANUFACTURER_COMBINE) are deferred until
/// per-entry scoring is factored out of the per-pick loop (ADR-0006 "To revisit").
/// </summary>
public sealed class RoundScoringContext(IReadOnlyDictionary<long, (decimal Points, int Version)> basePointsByPick)
{
    /// <summary>The pick's summed non-bonus points this pass (and the max contributing rule version),
    /// or null if the pick earned no scored source yet (e.g. results not in).</summary>
    public (decimal Points, int Version)? BasePoints(long pickId) =>
        basePointsByPick.TryGetValue(pickId, out var v) ? v : null;
}

/// <summary>Doubles the target pick's full MAIN total — qualifying plus every race of the round
/// (Q+R1+R2 on a multi-race weekend) (ADR-0006 D4). Shared by DOUBLE_POINTS_TEAM (target is a car
/// pick) and CAPTAIN (target is a driver pick); they differ only in the <c>AppliesTo</c> validated
/// at PUT time, not in scoring.</summary>
public sealed class DoubleTargetPickScorer(string kind) : IModifierScorer
{
    public string Kind { get; } = kind;

    public IEnumerable<BonusScore> Score(RosterModifier modifier, RoundScoringContext ctx)
    {
        if (modifier.TargetPickId is not { } pickId) yield break;
        if (ctx.BasePoints(pickId) is not { } b) yield break;   // not scored yet → no bonus row
        yield return new BonusScore(b.Points, b.Version);        // +1× delta; 2× shown as quali+race+bonus
    }
}

/// <summary>Registry of modifier scorers by kind (ADR-0006 D7). A kind with no scorer simply earns no
/// bonus — useful while a rule is offered but its handler isn't shipped yet.</summary>
public static class ModifierScorers
{
    private static readonly Dictionary<string, IModifierScorer> ByKind =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["DOUBLE_POINTS_TEAM"] = new DoubleTargetPickScorer("DOUBLE_POINTS_TEAM"),
            ["CAPTAIN"] = new DoubleTargetPickScorer("CAPTAIN"),
        };

    public static IModifierScorer? For(string kind) => ByKind.GetValueOrDefault(kind);
}
