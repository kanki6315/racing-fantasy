# Implementation Plan — Roster Modifiers (remove bonus drivers, add Double Points Team)

**Status:** Proposed
**Date:** 2026-06-17
**Implements:** [ADR-0006](adr/0006-roster-modifiers.md)
**Touches:** [ADR-0001](adr/0001-core-architecture.md) (roster txn), [ADR-0003](adr/0003-scoring-rules-engine.md) (scoring), [data-model.md](data-model.md)

The end state: a MAIN-only roster (no IMPACT/bonus drivers) plus a free, per-round
**Double Points Team** modifier that doubles one of the player's own MAIN picks, scored as a
transparent `BONUS` line. Built to generalise to a future Wildcard.

This plan is ordered so the backend stays compilable and the API stays coherent at each
step. Each step lists the files and the exact edit shape.

---

## Step 0 — Branch & safety

Backend `git` is not initialised at the repo root (CLAUDE.md notes `Is a git repository:
false`). Confirm version control before touching schema. Reset dev data is cheap:
`docker compose down -v && docker compose up -d` then `dotnet ef database update`.

---

## Step 1 — Domain model

**`src/Domain/Enums.cs`**
- Add `Bonus` to `ScoringSource` (after `RaceFastestLap`).
- Leave `SlotType { Main, Impact }` **as-is** for now (ADR-0006 D1 retires the *use* of
  `Impact`, not the enum value — avoids a destructive data migration). Add an XML-doc note
  that `Impact` is deprecated and no longer produced by the roster flow.

**`src/Domain/Picks.cs`** — add two entities:

```csharp
/// <summary>Which modifiers a season offers, how many per round, and the input shape (ADR-0006 D3).</summary>
public class RosterModifierRule
{
    public long Id { get; set; }
    public long SeasonId { get; set; }
    public required string Kind { get; set; }   // "DOUBLE_POINTS_TEAM", "CAPTAIN", …
    public int MaxCount { get; set; } = 1;
    public required string AppliesTo { get; set; } = "MainPick"; // MainPick | Driver | Manufacturer | None
    public Season Season { get; set; } = null!;
}

/// <summary>A player's modifier selection for a round (ADR-0006 D3). Free; flexible target.</summary>
public class RosterModifier
{
    public long Id { get; set; }
    public long RosterId { get; set; }
    public required string Kind { get; set; }
    public long? TargetPickId { get; set; }     // pick-targeted kinds (DOUBLE_POINTS_TEAM, CAPTAIN)
    public string Params { get; set; } = "{}";  // jsonb — non-pick targets (e.g. {"manufacturer":"Porsche"})
    public Roster Roster { get; set; } = null!;
    public Pick? TargetPick { get; set; }
}
```

Add `ICollection<RosterModifier> Modifiers` to `Roster`.

**`src/Domain/Scoring.cs`** — generalise `Score` ownership (ADR-0006 D4):
- Add `public long? RosterModifierId { get; set; }` and make `PickId` nullable
  (`public long? PickId`). A row is owned by **exactly one** of `PickId | RosterModifierId`.
  Position sources stay pick-owned; `BONUS` rows are modifier-owned.
- The idempotent recompute key becomes `(PickId, Source)` **or** `(RosterModifierId, Source)`.
  Add a DB `CHECK ((pick_id IS NULL) <> (roster_modifier_id IS NULL))` to enforce exactly-one.

**`src/Infrastructure/FantasyDbContext.cs`**
- `DbSet<RosterModifierRule>` and `DbSet<RosterModifier>`.
- Config: `RosterModifier` → `UNIQUE(roster_id, kind)`; FK `target_pick_id → pick(id)`
  with `OnDelete(Restrict)` (picks and modifiers are rewritten together in the PUT txn, so
  cascade isn't needed — Restrict surfaces ordering bugs loudly).
- `RosterModifierRule` → `UNIQUE(season_id, kind)`.
- `Score` → FK `roster_modifier_id → roster_modifier(id)`; the exactly-one CHECK above.
- Confirm the snake_case convention auto-applies (it does globally).

---

## Step 2 — Migration

```bash
dotnet ef migrations add RosterModifiers --project src/Infrastructure --startup-project src/Api
```

In the generated migration verify/adjust:
- `roster_modifier_rule` and `roster_modifier` tables + the two unique indexes + the FK.
- `score.roster_modifier_id` (nullable FK), `score.pick_id` made nullable, and the
  `CHECK ((pick_id IS NULL) <> (roster_modifier_id IS NULL))` exactly-one-owner constraint.
- The `scoring_source` CHECK/text column: `BONUS` is just a new allowed string value — no
  DB constraint exists if it's stored as free text (confirm in the migration that there is
  no enum/check to widen; if a CHECK exists, add `BONUS`).
- **Retire IMPACT data** (dev only): the migration can `DELETE FROM roster_rule WHERE
  slot_type = 'IMPACT'` and `DELETE FROM pick WHERE slot_type = 'IMPACT'`. Since only dev
  data exists, a `down` that no-ops these deletes is acceptable — note it in the migration.

---

## Step 3 — Resolver (single source of truth)

**`src/Api/Picks/RosterRulesResolver.cs`**
- Extend the result record:
  ```csharp
  public record ResolvedRosterRules(
      decimal SalaryCap,
      IReadOnlyList<ClassRequirement> Classes,
      IReadOnlyList<ModifierOption> Modifiers);          // replaces SlotRequirement? Impact
  public record ModifierOption(string Kind, int MaxCount, string AppliesTo); // AppliesTo: "MainPick"
  ```
- In `ResolveAsync`: **delete** the IMPACT branch; **add** a load of
  `RosterModifierRule` for the season → `ModifierOption` list, carrying each rule's
  `AppliesTo` (`"MainPick"` for `DOUBLE_POINTS_TEAM`/`CAPTAIN`).
- Modifier validation is **delegated to the per-kind handler** (Step 5's registry), not
  hard-coded here: the resolver provides the options + submitted-pick set, and each selected
  modifier's handler returns violations for unknown/!offered kind, count > MaxCount, and a
  target that doesn't match its `AppliesTo`. This keeps a new modifier's validation rules in
  one place with its scoring.

---

## Step 4 — PUT/GET roster endpoint

**`src/Api/Endpoints/RosterEndpoints.cs`**

Request/response DTOs:
```csharp
public record PutRosterRequest(List<RosterPickInput>? Main, List<ModifierInput>? Modifiers); // drop Impact
public record ModifierInput(string Kind, RosterPickInput? Target, JsonElement? Params);       // Target for pick-kinds; Params for the rest
```

PUT flow changes (keep everything inside the existing lock transaction):
1. Normalise `Main` (unchanged). **Remove** the `Impact` normalisation block.
2. Resolve rules; run composition `Violations` (unchanged) **and** the new modifier
   violations. Any → `422` with the violation list.
3. Full-replacement write: insert MAIN picks, `SaveChangesAsync()` to get their ids, build a
   map from each modifier's `Target` (entityType,entityId) → new `pick.Id`, then insert
   `RosterModifier` rows (`TargetPickId` resolved from that map). Delete prior modifiers
   alongside the prior picks (`ExecuteDeleteAsync` on both for this roster).
4. `BuildResponse` includes `modifiers:[{kind, target:{entityType,entityId}}]`.

GET roster: include the saved modifiers in the response (read `Roster.Modifiers` +
join to the target pick for the entity ref).

---

## Step 5 — Scoring engine

Introduce a **handler registry** (ADR-0006 D7) — the single place a `kind`'s validation and
scoring live, so a new modifier is one class, not edits scattered across endpoint + service:

```csharp
public interface IModifierHandler
{
    string Kind { get; }
    IEnumerable<ModifierViolation> Violations(ModifierSelection sel, ResolvedRosterRules rules, IReadOnlySet<PickKey> picks);
    IEnumerable<BonusScore> Score(RosterModifier mod, RoundScoringContext ctx);  // emits modifier-owned BONUS rows
}
```

- `RoundScoringContext` exposes `BasePoints(pickId)` now (what `DOUBLE_POINTS_TEAM` /
  `CAPTAIN` need). Stub `EntryPoints(classId)` and attribute lookups (`Manufacturer(...)`) —
  the `MANUFACTURER_COMBINE` handler will need them, but factoring per-entry scoring out of
  the per-pick loop is **deferred** (ADR-0006 "To revisit").
- MVP handlers `DoublePointsTeamHandler` and `CaptainHandler` are identical: read
  `ctx.BasePoints(mod.TargetPickId)`, emit one `BonusScore`. They differ only in `Kind` and
  the `AppliesTo` they validate against (a car-MAIN pick vs a driver pick).

**`src/Api/Scoring/ScoringService.cs`** — in `ScoreRoundAsync`:
1. **Remove** the IMPACT branch of `ComputePick` (the `RaceFastestLap` lookup). The
   `RaceFastestLap` ruleset/table stays in the codebase but is no longer consumed by the
   roster path (ADR-0006 D1).
2. After the per-pick `(source, points)` rows for a roster are computed, build a
   `RoundScoringContext` over them and run each `RosterModifier`'s handler `Score(...)`.
   Upsert each returned `BonusScore` as a **modifier-owned** row
   `Score { PickId = null, RosterModifierId = mod.Id, Source = Bonus, Points, RuleVersion =
   <max of the contributing MAIN source versions> }`. Computed *after* MAIN scoring, so on a
   quali-only pass the bonus = quali pts, on a race pass = quali+race (ADR-0006 D5).
3. `round_total` recompute (`ScoringService.cs:101-119`) currently maps `score → registration`
   via `pickToReg[s.PickId]`. **Add** a `modifierToReg` map (`roster_modifier → roster →
   registration`) and resolve the registration from whichever owner the row has. Then the
   existing `SUM` folds the `BONUS` rows in automatically.
4. `score_audit`: the existing "old vs new points" path applies to the `(roster_modifier_id,
   BONUS)` key with no special-casing.

---

## Step 6 — API contracts & frontend types

- Annotate the new roster + modifier DTOs with `.Produces<T>()` so they flow into the
  OpenAPI doc (the roster endpoints are player-facing and already annotated — match that).
- Regenerate the typed client: with the API running, `cd apps/web && pnpm gen:api`, then
  `pnpm build` to typecheck. (Frontend wiring of the modifier UI is a separate F-phase task;
  this plan stops at a coherent, typed contract.)

---

## Step 7 — Seed / dev board

**`apps/api/scripts/seed_dev_board.py`**
- Delete the IMPACT roster-rule block (the `# IMPACT: 1-2 drivers (bonus drivers)` section).
- Add `roster_modifier_rule` seeds for the dev season:
  `POST /roster-modifier-rules { seasonId, kind: "DOUBLE_POINTS_TEAM", maxCount: 1, appliesTo: "MainPick" }`
  and `{ kind: "CAPTAIN", maxCount: 1, appliesTo: "Driver" }`
  (add the admin endpoint for this rule alongside the existing `roster-rules` CRUD).
- `price_dev_board.py`: no longer needs to price standalone IMPACT drivers — verify it only
  prices cars/MAIN-eligible entities.

---

## Step 8 — Tests (ad-hoc Python against the running API, per repo convention)

1. **Happy path:** build a MAIN roster, set `DOUBLE_POINTS_TEAM` on one pick, ingest quali
   → assert `BONUS` = quali points; ingest race → assert `BONUS` = quali+race; assert
   `round_total` = sum incl. the doubled team.
2. **Recompute:** simulate a DSQ correction on the doubled team's car → re-score → assert the
   `BONUS` row and `round_total` track the corrected MAIN points, with a `score_audit` row.
3. **Validation:** reject (`422`) a modifier whose target isn't in the submitted MAIN picks;
   reject an unknown/!offered `kind`; reject count > `max_count`.
4. **Lock:** modifier edit after `quali_start` → `409`, same as picks.
5. **Captain:** same as test 1 but a `CAPTAIN` modifier on a driver pick — assert the
   driver pick's MAIN total is doubled via a modifier-owned `BONUS` row.
6. **Removal:** confirm no IMPACT slot is accepted and the old `impact[]` field is gone.

---

## Sequencing & risk

```
Step1 ─► Step2 ─► Step3 ─► Step4 ─► Step5 ─► Step6
 domain   migr.   resolver  PUT      scoring  contracts
                                              └► Step7 seed ─► Step8 tests
```

- **Lowest risk:** Steps 1–3 (additive domain + resolver) — compiles and runs with the new
  fields ignored by the endpoint until Step 4.
- **Highest-care:** Step 4 (the lock transaction — ADR-0001's integrity path) and Step 5
  (idempotent two-phase bonus). Both are covered by Step 8 tests 1–4.
- **Reversible:** dev data only; `docker compose down -v` resets if a migration misbehaves.

## Out of scope (deferred)

- Frontend modifier UI (pills/toggle on `/pick/:roundId`) — a later F-phase task; this plan
  delivers the typed contract it will consume.
- **`MANUFACTURER_COMBINE`** — the schema (`params jsonb`, `applies_to=Manufacturer`,
  modifier-owned `BONUS` rows) and the D7 handler contract already accommodate it. It is
  deferred because it needs two inputs the MVP lacks: (a) per-entry scoring factored out of
  the per-pick loop so `RoundScoringContext.EntryPoints` can score un-picked cars, and (b) a
  `manufacturer` dimension on `CarEntry` (none exists today). Build when that modifier ships.
- Dropping `slot_type` from `pick`/`roster_rule` — kept dormant to avoid churn.
