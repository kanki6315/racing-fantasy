# ADR-0006: Roster Modifiers (replacing IMPACT / bonus drivers)

**Status:** Accepted
**Date:** 2026-06-17
**Related:** [ADR-0001](0001-core-architecture.md) (D2, D3, D5, D6, D7), [ADR-0003](0003-scoring-rules-engine.md), [data-model.md](../data-model.md)
**Supersedes:** the **IMPACT slot / "bonus drivers"** concept from ADR-0001 (D6/D7) and ADR-0003.

## Context

The game shipped with two roster slots: **MAIN** (cars/drivers picked per class under
the salary cap, scored on qualifying + race position) and **IMPACT** (1–2 separately
picked "bonus drivers" scored on race fastest-lap rank). IMPACT has proven to be a poor
concept in practice:

- **It overloads the budget.** Bonus drivers are priced and compete for the same salary
  cap as the MAIN roster, so "do I spend on a strong car or a fastest-lap driver" is a
  confusing, low-signal trade-off that few players reason about well.
- **It overloads scoring.** A whole second scoring stream (`RACE_FASTEST_LAP`, sourced
  from a separate Al Kamel "Time Cards" file we don't yet ingest reliably — see
  [impact-fastest-lap-source]) exists solely to serve it.
- **It doesn't create the strategic texture we wanted.** The intended feeling — "make a
  bold call that could pay off big" — is better delivered by a *free* strategic lever than
  by a priced second roster.

We want to **remove bonus drivers** and replace them with **dynamic, per-round bonus
modifiers** the player applies to picks they've *already* made. The first is
**Double Points Team**: designate one of your MAIN picks to score double, with the extra
points shown as a clearly-labelled **bonus** line. The design must generalise — a
**Wildcard** and other modifiers should slot into the same machinery — because the point
is to keep adding cheap, creative levers over time.

A key architectural observation framed this ADR: the existing `scoring_bonus` table is the
**wrong** home for this. `scoring_bonus` is **global, admin-authored season config**
(pole, beat-teammate — one rule, applies to everyone). A modifier like Double Points Team
is a **per-user, per-round roster decision**. That is a different axis, and the roster/pick
model has no place to record it today.

## Decision

Introduce a first-class **roster modifier** concept: a per-roster, player-selected lever
that alters how that player's own picks score, governed by season-level config and scored
through a new `BONUS` source so the effect is transparent and reproducible.

### What changes, in one picture

```
BEFORE                                  AFTER
  Roster                                  Roster
  ├─ MAIN picks  (cars, priced) ────►     ├─ MAIN picks (cars, priced)   ← unchanged
  └─ IMPACT picks (drivers, priced) ✗     └─ Modifiers  (free, targeted) ← new
                                                └─ DOUBLE_POINTS_TEAM → one MAIN pick
```

### D1 — Remove the IMPACT roster slot

The IMPACT slot, its `roster_rule`, and the "bonus driver" pick path are removed from the
active roster flow. Players now build a **MAIN-only** roster (cars per class under the cap),
exactly as before minus the second slot. The `RACE_FASTEST_LAP` scoring source and the
`race_fastest_lap` table are **retired but retained dormant** — cheap to keep, and a likely
input to a future modifier (e.g. a "fastest-lap hunter"). No destructive drop of historical
scoring data.

### D2 — Modifiers are free and player-selected

A modifier costs **no salary** and is chosen at roster time alongside the picks it targets.
Free is deliberate: it removes the budget overload that sank IMPACT and turns the modifier
into a pure strategic/creative choice — which is the behaviour we want to encourage. The
salary cap (ADR-0001 D2) is untouched.

### D3 — Modifiers are data, on two axes

Mirroring the rules-as-data ethos of [ADR-0003](0003-scoring-rules-engine.md):

```sql
-- Rules layer: which modifiers a season offers, how many of each per round, and what
-- input the player supplies (so the resolver can tell the UI which selector to render).
roster_modifier_rule(id, season_id, kind, max_count, applies_to)  -- applies_to: MainPick | Driver | Manufacturer | None

-- Roster layer: the player's actual selections for a round.
roster_modifier(id, roster_id, kind, target_pick_id, params jsonb) -- target_pick_id nullable
```

- `kind` is an open string (`DOUBLE_POINTS_TEAM`, `CAPTAIN`, future `MANUFACTURER_COMBINE`, …)
  so a new modifier is a config row + a handler, not a schema change.
- **The target is flexible by design.** Pick-targeted modifiers (`DOUBLE_POINTS_TEAM`,
  `CAPTAIN`) use `target_pick_id`. Modifiers that target something *other* than one of the
  player's picks (`MANUFACTURER_COMBINE` targets a manufacturer; a future roster-wide chip
  targets nothing) carry their selection in `params jsonb` and leave `target_pick_id` null.
  `applies_to` on the rule names the input type so the resolver and `PUT` validation know
  what shape to expect — see D6.
- `UNIQUE(roster_id, kind)` for the MVP (at most one of each kind per roster); `max_count`
  in the rule allows >1 later.
- Because `PUT roster` is a **full replacement** (ADR-0001 D5 lock txn), modifiers are
  rewritten in the **same transaction** as the picks they target — picks are inserted
  first, then modifiers reference the fresh `pick` rows. No cross-PUT dangling references.

### D4 — A new `BONUS` scoring source

Add `BONUS` to `ScoringSource` (alongside `QUALIFYING_POSITION`, `RACE_POSITION`,
`RACE_FASTEST_LAP`). The modifier's effect is emitted as its **own** `score` row so it is
visible and auditable, never folded silently into a position score:

- **Double Points Team** doubles the target pick's **full** MAIN total — both qualifying
  *and* race position. The `BONUS` row equals the **sum of that pick's non-bonus points**
  (the `+1×` delta), so the displayed breakdown reads `quali + race + bonus = 2× team`.
- **`BONUS` rows are keyed to the *modifier*, not a pick.** `score` gains a nullable
  `roster_modifier_id`; a `score` row is owned by **exactly one of `pick_id | roster_modifier_id`**.
  Position sources stay pick-owned; every `BONUS` row is modifier-owned. The idempotent
  recompute key generalises from `(pick_id, source)` to `(owner, source)`, and `score_audit`
  follows unchanged. **Why modifier-owned, not pick-owned:** a `DOUBLE_POINTS_TEAM` bonus
  *could* hang off its target pick, but `MANUFACTURER_COMBINE` produces a bonus attached to
  no pick the player made. Keying all bonuses to the modifier is the only model that fits
  every modifier uniformly — and it's a cheap choice made now to avoid a later migration.
- `round_total` is already a **recomputed `SUM(score.points)`** per registration per round
  (not an increment), so the bonus folds into totals and leaderboards with **no change** to
  the totals logic — modifier-owned rows map to a registration via `roster_modifier → roster
  → registration`, the same way pick-owned rows map via `pick → roster → registration`.

### D5 — Two-phase semantics preserved

The bonus respects ADR-0003's two-phase cadence. The `BONUS` row is **derived and
overwritten on every scoring pass** to equal the target pick's current non-bonus points:

```
QUALIFYING published → score MAIN quali → BONUS(target) = quali pts          → round_total recompute
RACE published       → score MAIN race  → BONUS(target) = quali pts + race pts → round_total recompute
```

So the bonus grows as its underlying points land, and a corrected result re-scores the
bonus through the same idempotent path. The `BONUS` row stamps the `rule_version` of the
MAIN ruleset(s) it derives from (it is a pure function of them).

### D6 — One resolver, one source of truth

The roster-rules resolver — which backs **both** the UI pills and `PUT` validation
(ADR-0001 D5) — is extended to return the available modifiers:

```
GET /rounds/{id}/roster-rules → {
  salaryCap, classes:[…],
  modifiers:[ { kind:"DOUBLE_POINTS_TEAM", maxCount:1, appliesTo:"MainPick" } ]
}
```

`PUT roster` validates, in the same transaction as lock + cap + composition: each selected
modifier's `kind` is offered this season, its count ≤ `max_count`, and its target matches
`applies_to` — a `MainPick`/`Driver` modifier's target is **one of the player's own
submitted picks**; a `Manufacturer` modifier's `params.manufacturer` is a real manufacturer
running this round (else `422`). The pills can't disagree with submit because the same
resolver feeds both.

### D7 — A uniform modifier-handler contract (so every modifier is "the same path")

Each `kind` is implemented as a handler resolved from a `kind → handler` registry, never an
inline `switch`. The interface has exactly two hooks, mirroring the two injection points
(pick-time validation, score-time computation):

```
IModifierHandler {
  string Kind;
  IEnumerable<Violation> Violations(ModifierSelection sel, ResolvedRosterRules rules, IReadOnlySet<PickKey> picks);
  IEnumerable<BonusScore>  Score(RosterModifier mod, RoundScoringContext ctx);   // emits modifier-owned BONUS rows
}
```

`RoundScoringContext` is the key to the family staying one path. It exposes more than "the
player's own pick scores":

- `BasePoints(pickId)` — a pick's computed non-bonus points (what `DOUBLE_POINTS_TEAM` /
  `CAPTAIN` need; both are one-liners over this).
- `EntryPoints(classId)` — computed points for **every** entry in a class this round, not
  only picked ones (what `MANUFACTURER_COMBINE` needs: max manufacturer car per class).
- attribute lookups (`Manufacturer(entityId)`, …).

This means the per-entry scoring logic must be factored **out** of the per-pick loop so it
can be invoked for any entry, not just picks. That factoring — and a `manufacturer` catalog
dimension, which **does not exist today** (`CarEntry` has none) — are the *only* things
`MANUFACTURER_COMBINE` needs beyond the MVP, and both are deferred until it is built. The
MVP modifiers (`DOUBLE_POINTS_TEAM`, `CAPTAIN`) ignore `EntryPoints`/attributes entirely.

Crucially, every modelled and planned modifier is **additive, post-results, and changes no
rule or eligibility** — the handler only ever *reads* a scoring context and *emits* `BONUS`
rows. Modifiers that would relax roster rules or substitute results are explicitly **out of
scope** (rule changes belong in round/season config, not a player chip), which is what keeps
this single contract sufficient.

## Options Considered

### Option A: First-class roster modifiers on two axes (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — two small tables, one new source, a resolver + validation extension |
| Flexibility | High — new modifiers are a config row + handler; generalises to Wildcard |
| Correctness | High — reuses `(pick_id, source)` idempotency, audit, and `SUM`-based totals |
| Player clarity | High — free lever, bonus shown as its own line |

**Pros:** Clean separation of *rules* (what a season offers) from *selections* (what a
player chose); reuses the entire idempotent scoring/audit/total machinery; transparent
scoring; a deliberate generalisation point for future levers.
**Cons:** A new schema surface and a modifier handler dispatch to build and maintain.

### Option B: Reuse `scoring_bonus` with team-id params

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low at first glance |
| Flexibility | Low — wrong axis |
| Correctness | Poor — can't express *per-user* choice |

**Pros:** No new tables.
**Cons:** `scoring_bonus` is **global, admin-authored** config — it has no concept of
"this user chose this team." Encoding per-user selections as admin params is a category
error that would corrupt the ruleset model and break reproducibility. Rejected.

### Option C: A boolean flag on `pick` (`is_double_points`)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Lowest |
| Flexibility | Low — one boolean per modifier, forever |
| Correctness | Adequate for exactly one modifier |

**Pros:** Trivial to add.
**Cons:** Every future modifier accretes another boolean and another special case; no place
for non-targeted modifiers (Wildcard) or per-season availability/limits. Solves today and
taxes every tomorrow. Rejected in favour of the generalisable Option A.

## Trade-off Analysis

The decision hinges on **where a per-user, per-round choice belongs.** It is neither global
scoring config (Option B's mistake) nor a property of a single pick (Option C's ceiling) —
it is a *roster-scoped selection governed by season rules*, which is precisely the shape of
Option A's two tables. Paying for the small schema surface now buys a generalisation point:
the second, third, and fourth modifier (Wildcard included) cost a config row and a handler,
not a migration and a new special case. And by routing the effect through a `BONUS` `score`
row keyed `(pick_id, source)`, we inherit idempotent recompute, the audit trail, and
`SUM`-based totals for free — the expensive, correctness-critical parts are already built.

## Consequences

**Easier:**
- The budget and scoring models simplify: one priced roster slot, no second pricing stream.
- New modifiers (Wildcard, …) are additive — a `roster_modifier_rule` row plus a handler.
- The bonus is transparent (its own line) and reproducible (stamped `rule_version`,
  idempotent recompute, audit row) with no new totals logic.

**Harder:**
- `PUT roster` validation grows a modifier branch (count, kind-offered, target-is-own-pick).
- Modifier handler dispatch in the scoring pass — kept small and data-driven to avoid a
  scoring `switch` sprawling over time.
- `BONUS` `rule_version` provenance is derived from the MAIN rulesets rather than its own
  `position_points` table — documented, revisit if modifiers need independent versioning.

**To revisit:**
- **`MANUFACTURER_COMBINE` prerequisites (deferred, not blocking):** it needs (a) the
  per-entry scoring factored out of the per-pick loop so `RoundScoringContext.EntryPoints`
  can score un-picked cars, and (b) a `manufacturer` catalog dimension on `CarEntry`, which
  does not exist today. The D7 handler contract already accommodates it; only these two
  inputs are missing. Add when that modifier is built.
- The contract assumes every modifier is **additive / post-results / rule-neutral**. A
  modifier that relaxed roster rules (→ belongs in round/season config) or substituted
  results (→ explicitly unwanted) would break that assumption and need a different design.
  Holding the line on "additive bonus only" is what keeps D7 sufficient.
- Whether `slot_type` should be dropped from `pick`/`roster_rule` once IMPACT is gone and
  the roster is MAIN-only (kept for now to minimise migration churn).
- Whether `roster_modifier_rule` should gain a `version`/`status` lifecycle like
  `scoring_ruleset` if modifier availability needs to change reproducibly mid-season.

## Action Items

1. [ ] Schema: add `roster_modifier_rule(season_id, kind, max_count, applies_to)` and
   `roster_modifier(roster_id, kind, target_pick_id, params jsonb)`; add nullable
   `roster_modifier_id` to `score` (owner = exactly one of `pick_id | roster_modifier_id`);
   add `BONUS` to the `scoring_source` constraint. Migration retires the IMPACT `roster_rule`
   and stops the IMPACT pick path; leaves `race_fastest_lap` + the `RACE_FASTEST_LAP` ruleset
   dormant.
2. [ ] Domain: `RosterModifier` + `RosterModifierRule` entities; `Score.RosterModifierId`;
   `ScoringSource.Bonus`; retire `SlotType.Impact` from the active roster flow.
3. [ ] Handler registry (D7): `IModifierHandler` + a `kind → handler` map; implement
   `DOUBLE_POINTS_TEAM` and `CAPTAIN` (identical logic, pick-targeted). `RoundScoringContext`
   exposes `BasePoints(pickId)` now; `EntryPoints`/attribute lookups stubbed for later.
4. [ ] Resolver: extend `ResolvedRosterRules` with `modifiers:[{kind,maxCount,appliesTo}]`;
   drop the IMPACT branch.
5. [ ] `PUT roster`: accept `modifiers:[{kind,target?,params?}]`, drop `impact[]`; delegate
   per-kind validation to the handler (kind-offered, count ≤ max, target matches `appliesTo`)
   — in the lock transaction.
6. [ ] Scoring: after MAIN scoring, run each roster's modifier handlers; upsert their
   modifier-owned `BONUS` rows; verify two-phase growth and idempotent recompute. Map
   modifier-owned scores to a registration in the `round_total` recompute.
7. [ ] API contracts: annotate the modifier DTOs; regenerate the frontend client
   (`pnpm gen:api`). Update `GET roster` / `GET scores` to surface modifiers + bonus.
8. [ ] Seed/config: seed `DOUBLE_POINTS_TEAM` and `CAPTAIN` (`max_count=1`) for the dev
   season; update `seed_dev_board.py` to drop IMPACT rules and add the modifier rules.
9. [ ] Tests: bonus = 2× target total across both phases (team and captain); recompute after
   a simulated DSQ; reject a modifier targeting another player's / a non-existent pick;
   reject over-count; reject a kind not offered this season.
