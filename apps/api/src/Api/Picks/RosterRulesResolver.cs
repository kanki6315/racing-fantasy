using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Picks;

/// <summary>
/// Single source of truth for a round's roster rules (ADR-0001 D4/D5): the salary cap (from the
/// round) plus the legal composition — season <see cref="RosterRule"/>s intersected with the classes
/// actually running this round (derived from its <see cref="Session"/>s). Both the player-facing
/// <c>GET /rounds/{id}/roster-rules</c> and the roster PUT validation resolve through here, so the
/// live composition pills can never disagree with submit-time validation.
/// </summary>
public static class RosterRulesResolver
{
    public static async Task<ResolvedRosterRules> ResolveAsync(FantasyDbContext db, Round round)
    {
        var runningClassIds = await db.Sessions.Where(s => s.RoundId == round.Id)
            .Select(s => s.ClassId).Distinct().ToListAsync();
        // Season defaults (RoundId null) + this round's overrides; per class the override wins (below).
        var rules = await db.RosterRules
            .Where(r => r.SeasonId == round.SeasonId && (r.RoundId == null || r.RoundId == round.Id))
            .ToListAsync();
        var classes = await db.Classes.Where(c => runningClassIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => new { c.Name, c.Color, c.SortOrder });

        var mainClasses = rules
            .Where(r => r.SlotType == SlotType.Main && r.ClassId is { } cid && runningClassIds.Contains(cid))
            .GroupBy(r => r.ClassId!.Value)
            .Select(g =>
            {
                // Round override (RoundId == round.Id) sorts before the season default (RoundId == null).
                var rule = g.OrderByDescending(r => r.RoundId == round.Id).First();
                return new ClassRequirement(
                    rule.ClassId!.Value,
                    classes.GetValueOrDefault(rule.ClassId!.Value)?.Name,
                    classes.GetValueOrDefault(rule.ClassId!.Value)?.Color,
                    rule.MinPicks, rule.MaxPicks);
            })
            // Admin-set class rank first (racing order: GTP, LMP2, GTD PRO, GTD), name as the tiebreak.
            .OrderBy(c => classes.GetValueOrDefault(c.ClassId)?.SortOrder ?? 0)
            .ThenBy(c => c.Name)
            .ToList();

        var modifiers = (await db.RosterModifierRules.Where(r => r.SeasonId == round.SeasonId).ToListAsync())
            .Select(r => new ModifierOption(r.Kind, r.MaxCount, r.AppliesTo))
            .OrderBy(m => m.Kind)
            .ToList();

        return new ResolvedRosterRules(round.SalaryCap, mainClasses, modifiers);
    }

    /// <summary>
    /// Composition violations for a candidate set of MAIN picks (per offending class). Empty list ⇒
    /// legal composition. IMPACT is retired (ADR-0006) — bonuses are modifiers, validated separately.
    /// </summary>
    public static List<CompositionViolation> Violations(
        ResolvedRosterRules rules, IEnumerable<long> mainPickClassIds)
    {
        var byClass = mainPickClassIds.GroupBy(id => id).ToDictionary(g => g.Key, g => g.Count());
        var violations = new List<CompositionViolation>();
        foreach (var c in rules.Classes)
        {
            var have = byClass.GetValueOrDefault(c.ClassId);
            if (have < c.Min || have > c.Max)
                violations.Add(new CompositionViolation(c.Name, c.ClassId, "Main", have, c.Min, c.Max));
        }
        return violations;
    }

    /// <summary>
    /// Modifier-selection violations (ADR-0006 D6). Validation is uniform on <c>AppliesTo</c>: the kind
    /// must be offered this season, its count ≤ <c>MaxCount</c>, and a pick-targeted kind's target must
    /// be one of the player's own submitted MAIN picks (of the required entity type). Empty ⇒ legal.
    /// </summary>
    public static List<ModifierViolation> ModifierViolations(
        ResolvedRosterRules rules,
        IReadOnlyList<ModifierSelection> selections,
        IReadOnlySet<(EntityType EntityType, long EntityId)> mainPicks)
    {
        var offered = rules.Modifiers.ToDictionary(m => m.Kind, StringComparer.OrdinalIgnoreCase);
        var violations = new List<ModifierViolation>();
        foreach (var group in selections.GroupBy(s => s.Kind, StringComparer.OrdinalIgnoreCase))
        {
            if (!offered.TryGetValue(group.Key, out var opt))
            {
                violations.Add(new ModifierViolation(group.Key, "not_offered"));
                continue;
            }
            var picked = group.ToList();
            if (picked.Count > opt.MaxCount)
                violations.Add(new ModifierViolation(group.Key, "too_many"));

            foreach (var sel in picked)
            {
                switch (opt.AppliesTo)
                {
                    case "MainPick":
                    case "Driver":
                        if (sel.Target is not { } t || !mainPicks.Contains((t.EntityType, t.EntityId)))
                            violations.Add(new ModifierViolation(group.Key, "target_not_in_roster"));
                        else if (opt.AppliesTo == "Driver" && t.EntityType != EntityType.Driver)
                            violations.Add(new ModifierViolation(group.Key, "target_wrong_type"));
                        break;
                    // "Manufacturer" / "None": validated when those kinds ship (ADR-0006 "To revisit").
                }
            }
        }
        return violations;
    }
}

public record ResolvedRosterRules(decimal SalaryCap, IReadOnlyList<ClassRequirement> Classes, IReadOnlyList<ModifierOption> Modifiers);
public record ClassRequirement(long ClassId, string? Name, string? Color, int Min, int Max);
public record ModifierOption(string Kind, int MaxCount, string AppliesTo);

/// <summary>One submitted modifier for validation: its kind and (for pick-targeted kinds) its target entity.</summary>
public record ModifierSelection(string Kind, (EntityType EntityType, long EntityId)? Target);
public record ModifierViolation(string Kind, string Reason);

/// <summary>A single composition rule violation. Class/ClassId are null for non-class violations.
/// (camelCase web policy serializes <c>Class</c> → <c>"class"</c>, matching the prior contract.)</summary>
public record CompositionViolation(string? Class, long? ClassId, string Slot, int Have, int Min, int Max);
