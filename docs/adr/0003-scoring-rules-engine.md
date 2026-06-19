# ADR-0003: Scoring Rules Engine

**Status:** Accepted
**Date:** 2026-06-16
**Related:** [ADR-0001](0001-core-architecture.md) (D6, D7, D8)

> **Amendment (2026-06-17): IMPACT replaced by roster modifiers — see [ADR-0006](0006-roster-modifiers.md).**
> The IMPACT slot ("bonus drivers", scored on `RACE_FASTEST_LAP`) is removed from the active
> roster flow and replaced by free, per-round **roster modifiers**. The first, **Double
> Points Team**, doubles one MAIN pick and is scored through a new **`BONUS`** source
> (`score` keyed `(pick_id, BONUS)`), reusing this engine's idempotent recompute, audit, and
> `SUM`-based `round_total` unchanged. `RACE_FASTEST_LAP` and `race_fastest_lap` are retained
> dormant. Where this ADR says "IMPACT", read "the removed bonus-driver stream".

> **Amendment (2026-06-17): MAIN scores qualifying AND race position.** MAIN picks
> now earn points from **two** sources — qualifying position *and* race finishing
> position (both class-relative) — instead of qualifying alone. IMPACT (race
> fastest lap) is unchanged. Concretely: `scoring_ruleset` is keyed by a **`source`**
> (`QUALIFYING_POSITION` | `RACE_POSITION` | `RACE_FASTEST_LAP`) rather than
> `slot_type`; each `score`/`score_audit` row carries its `source` (key
> `(pick_id, source)`); and a new `race_result` table holds per-class finishing
> positions. The "two-phase" framing below generalises to **three sources across
> two publish points**: QUALIFYING_POSITION at quali publish; RACE_POSITION +
> RACE_FASTEST_LAP at race publish. `round_total` sums all sources. See
> [data-model.md](../data-model.md).

## Context

Scoring is the heart of the game, and it has three properties that shape its
design:

- **Two independent streams from different sessions.** MAIN picks (teams/drivers)
  score from **qualifying** results. IMPACT drivers score a separate bonus from
  **race fastest-lap** times. The two streams come from different sessions that
  publish at different times.
- **Class-relative.** Comparing a GTD pole to a GTP pole is meaningless. Both
  ranking streams must rank *within class*.
- **Rules change, and results change.** Fantasy scoring is tuned between seasons,
  so rules must be editable without a code deploy and every historical total must
  remain reproducible. And sportscar results are corrected constantly after the
  flag — post-qualifying grid penalties, post-race DSQs, stripped lap times — so
  any total may need to be recomputed from corrected inputs.

A naive "score it in code at end of weekend" approach fails all three: it blocks
quali points on race data, bakes rules into deploys, and has no clean recompute
path.

## Decision

Build a **versioned, data-driven scoring engine** that runs in **two phases per
round** and recomputes **idempotently** from corrected results.

### Rules as versioned data

```sql
scoring_ruleset(id, season_id, slot_type, version,    -- slot_type: MAIN | IMPACT
                status, effective_from)               -- DRAFT | ACTIVE | ARCHIVED
position_points(ruleset_id, rank, points)             -- 1 -> 25, 2 -> 18, ...
scoring_bonus(ruleset_id, kind, params jsonb)         -- POLE, BEAT_TEAMMATE, ...
```

- Both streams **rank within class, then map rank → points off a shared table.**
  Ranking is class-relative; points are class-agnostic, so a class pole is worth
  the same in every class. Fairness without per-class point scales.
- Changing scoring = a **new ruleset version**, not a deploy. Every computed
  `score` row stamps its `rule_version`, so any total is reproducible and
  explainable ("scored under MAIN v2").

### Two-phase scoring per round

A round emits **two scoring events**, because its inputs land at different times:

```
QUALIFYING published ──► score MAIN picks   ──► round_total += main   ──► leaderboard update
RACE published       ──► score IMPACT picks ──► round_total += impact ──► leaderboard update
```

- **MAIN** ← qualifying position within class → `position_points` + bonuses.
- **IMPACT** ← race fastest lap, ranked within class → `position_points` of the
  IMPACT ruleset.
- `round_total` is the running sum of whatever has been scored so far; the
  leaderboard is correct at every intermediate state. The board moves twice per
  weekend (good product), and quali points never wait on race data.

### Idempotent recompute keyed by `(pick_id, rule_version)`

```
corrected result ingested ──► results.published(session, revision=n)
                              └─► re-score every pick on that session
                                  └─► overwrite score, recompute round_total, rebuild board
```

Scoring is a pure function of (results, ruleset). Re-ingesting a corrected
session re-emits its scoring event; the worker overwrites the affected `score`
rows, recomputes `round_total`, and rebuilds the affected leaderboard slice. An
audit row per recompute (`computed_at`, old/new points) explains any total that
changes overnight. Corrections flow only through the **admin-approved ingestion
path** (see [ADR-0001](0001-core-architecture.md) D8), never live from a feed.

## Options Considered

### Option A: Versioned data-driven engine, two-phase, idempotent (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — a small rules schema and an event-driven worker |
| Flexibility | High — rule changes are data; recompute is first-class |
| Correctness | High — reproducible totals, clean handling of corrections |
| Team familiarity | Medium |

**Pros:** Rule changes ship without deploys; totals are reproducible and
explainable; corrections (the common case) re-run cleanly; quali points publish
independent of race data.
**Cons:** More upfront design than hardcoding; a rules schema to maintain.

### Option B: Hardcoded scoring in application code

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low (initially) |
| Flexibility | Low — every rule tweak is a code change + deploy |
| Correctness | Fragile — no stamped version, recompute is ad hoc |
| Team familiarity | High |

**Pros:** Fastest to a first version.
**Cons:** Every scoring tweak becomes a deploy; historical totals aren't
reproducible once the code changes; corrections have no principled recompute path.
The first mid-season rule change makes this expensive.

### Option C: Single end-of-weekend scoring pass

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Flexibility | Low |
| Correctness | Adequate but coarse |
| Team familiarity | High |

**Pros:** One job, one event.
**Cons:** Blocks quali (MAIN) points on race data even though they're known
Saturday; hides the mid-weekend leaderboard movement that makes the product feel
alive; couples two independent streams that have no reason to be coupled.

## Trade-off Analysis

The core trade is **upfront design cost (Option A) vs. time-to-first-version
(Options B/C).** Both cheaper options collapse the moment the two realities of
this domain show up — and they always do: scoring gets tuned, and results get
corrected. Hardcoding (B) turns every rule change into a deploy and abandons
reproducibility; a single scoring pass (C) needlessly couples the two streams and
delays quali points that are already known.

Splitting into two phases costs almost nothing extra given the engine is already
event-driven, and it directly improves the product (a leaderboard that moves twice
a weekend) while decoupling streams that publish at different times. Versioning and
idempotent recompute are what make corrections — the routine reality of sportscar
results — a one-button operation instead of a manual scramble.

## Consequences

**Easier:**
- Scoring rules change as data; no deploy, and every total carries its
  `rule_version` for reproducibility.
- Result corrections re-run through one idempotent path; users get an audit trail
  for any total that moves.
- MAIN points publish Saturday, independent of race data.

**Harder:**
- A rules schema and an event-driven worker to build and maintain.
- Leaderboard rebuilds on recompute must reconcile against Postgres (see
  [ADR-0001](0001-core-architecture.md) D9).
- Care needed that bonuses (`scoring_bonus`) stay expressible as data; a
  genuinely novel bonus may need an engine extension rather than a config row.

**To revisit:**
- If bonus rules outgrow `params jsonb`, consider a small expression/DSL or
  per-kind handlers.
- If a future ruleset needs per-class point scales (not just class-relative
  ranking), extend `position_points` with a `class_id` dimension.
- Consider materializing per-pick score breakdowns for a "why did I get these
  points" UI.

## Action Items

1. [ ] Create schema: `scoring_ruleset`, `position_points`, `scoring_bonus`, and the `score` / `round_total` tables stamping `rule_version`.
2. [ ] Implement MAIN scoring (class-relative qualifying rank → points + bonuses).
3. [ ] Implement IMPACT scoring (class-relative race fastest-lap rank → points).
4. [ ] Wire two scoring events (`QUALIFYING published`, `RACE published`) to the worker; maintain `round_total` as a running sum.
5. [ ] Implement idempotent recompute keyed by `(pick_id, rule_version)` with a per-recompute audit row.
6. [ ] Rebuild affected Redis leaderboard slices on recompute; add the Postgres reconciliation job.
7. [ ] Seed an initial ACTIVE ruleset per championship/season; build the admin flow to author and version rulesets.
8. [ ] Tests: class-relative ranking, two-phase running totals, recompute after a simulated DSQ/penalty, reproducibility under a version bump.
