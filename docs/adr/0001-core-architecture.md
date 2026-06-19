# ADR-0001: Core Architecture for the IMSA Fantasy League

**Status:** Accepted
**Date:** 2026-06-16

> **Amendment (2026-06-17): IMPACT slot replaced by roster modifiers — see [ADR-0006](0006-roster-modifiers.md).**
> The two-stream "MAIN + IMPACT (bonus drivers)" roster in the Context and ledger (D6/D7) is
> superseded. IMPACT is removed; the roster is MAIN-only plus free, per-round **roster
> modifiers** (first: Double Points Team). The transactional `PUT roster` integrity path (D5)
> is unchanged — it now also validates modifier selections in the same lock transaction.

## Context

We are building a motorsports fantasy league focused on the IMSA series. The
defining requirements and forces:

- **Multi-championship, opt-in.** WeatherTech, Michelin Pilot Challenge, MX-5
  Cup, etc. Users register for each championship independently; standings,
  budgets, and roster rules are per championship/season.
- **Multi-class within a championship.** WeatherTech runs GTP / LMP2 / GTD PRO /
  GTD; Pilot Challenge runs GS / TCR; MX-5 is single-class. Qualifying results
  and prices are per class, and scoring must be class-relative.
- **Per-round salary-cap picks.** Each round, a user picks multiple teams and/or
  drivers under a fixed cap. Prices change every round; rosters are fully
  independent round to round (no bankroll carryover) because sportscar entry
  lists churn heavily.
- **Roster composition rules.** Multi-class events require a minimum number of
  picks per class, enforced only for classes actually running that weekend.
- **Hard lock at qualifying.** Picks freeze the instant the round's qualifying
  begins. A leaked late edit corrupts the integrity of the game.
- **Two-stream, two-phase scoring.** MAIN picks score from qualifying results;
  IMPACT drivers score a separate bonus from *race* fastest-lap times. The two
  streams come from different sessions and publish at different times.
- **Dirty results data.** There is no clean public IMSA results API. Data
  arrives via timing feeds, PDFs, and manual entry, and is frequently corrected
  after the flag (post-qualifying grid penalties, post-race DSQs, stripped lap
  times).

**Non-functional shape.** This is a niche audience: plan for ~10k–50k registered
users with low steady-state traffic and **sharp, predictable bursts** — everyone
editing in the final minutes before lock, and everyone refreshing when results
publish. Correctness at the lock boundary and in scoring matters more than raw
throughput or five-nines availability; a few minutes of read-only degradation is
survivable, a late edit is not.

These forces point away from a throughput-optimized, heavily-distributed design
and toward a **simple, correctness-first system with a few well-defended hot
paths.**

## Decision

Build a **modular monolith API + background worker + an isolated results
ingestion service**, backed by **PostgreSQL as the source of truth** and **Redis
for hot-read caching, the lock countdown, and leaderboards.**

```
                    ┌─────────────┐
   Browser/App ───► │   API (BFF) │ ──► Postgres (source of truth)
                    │  stateless  │ ──► Redis (cache, countdown, leaderboards)
                    └──────┬──────┘
                           │ enqueue
                           ▼
                    ┌─────────────┐
                    │  Job worker │  scoring, leaderboard recompute, lock sweep
                    └──────┬──────┘
                           ▲ results.published
              ┌────────────┴────────────┐
              │  Results ingestion svc  │ ◄── timing feed / PDF / admin entry
              └─────────────────────────┘
```

The single architecturally load-bearing split is **ingestion**, isolated so its
failure modes (bad feed, schema drift, mid-correction state) can never touch the
pick-taking path. Everything else stays in one deployable to keep operational
surface small.

The domain decisions resolved alongside this architecture are recorded in the
**Decisions Ledger** below; the most consequential (lock model, scoring engine)
are candidates for their own focused ADRs.

## Options Considered

The genuine architectural fork is how much to distribute the system up front.

### Option A: Modular monolith + worker + isolated ingestion (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — one primary deployable plus an isolated ingestion service |
| Cost | Low — single Postgres primary + read replica, one Redis, small autoscaling API tier |
| Scalability | Ample for the scale; stateless API absorbs lock/results bursts horizontally |
| Team familiarity | High — standard web stack, no distributed-systems tax |

**Pros:**
- Matches the real scale; nothing is over-built.
- Lock + cap + composition validation lives in one transactional path — easy to
  reason about and to keep correct.
- Ingestion, the dirtiest dependency, is the one thing quarantined.
- Cheap to operate and to onboard new engineers.

**Cons:**
- Scoring and API share a deployable; a very heavy future scoring model would
  need extraction.
- Less "future-proof" on paper than a service mesh (but YAGNI at this scale).

### Option B: Microservices (separate picks, scoring, catalog, leaderboard services)

| Dimension | Assessment |
|-----------|------------|
| Complexity | High — service boundaries, inter-service contracts, distributed debugging |
| Cost | High — more infra, more CI/CD, more on-call surface |
| Scalability | Excellent, but far beyond what the load requires |
| Team familiarity | Lower — distributed-systems overhead for a small team |

**Pros:** Independent scaling/deploy per concern; clean blast-radius isolation.
**Cons:** Massive complexity and cost premium unjustified at 10k–50k users; the
transactional lock/cap/composition check would span services or need a saga —
strictly worse for the property that matters most.

### Option C: Serverless functions + managed DB

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — many small functions, orchestration glue |
| Cost | Low at idle, but cold starts hurt the very bursts we care about |
| Scalability | Auto, but uneven |
| Team familiarity | Medium |

**Pros:** Scales to zero between race weekends; no idle cost.
**Cons:** Cold starts at the lock spike are exactly the wrong failure; long-lived
scoring/recompute jobs fit functions poorly; transactional integrity is harder to
guarantee across function invocations.

## Trade-off Analysis

The decision hinges on **what we are optimizing for: throughput vs. correctness
at low scale.** The traffic profile is modest and bursty, not sustained-high, so
distribution (Option B) buys scalability we will not use while taxing the exact
property we cannot compromise — the atomic lock + cap + composition check, which
is trivial in a single transaction and painful across services.

Serverless (Option C) is tempting for the scale-to-zero economics of a sport with
gaps between weekends, but its cold-start behavior degrades the lock spike — the
one moment the system must be sharp — and it fits long-running scoring/recompute
jobs poorly.

The monolith (Option A) keeps the integrity-critical path in one transaction,
keeps cost and operational surface minimal, and still absorbs both predictable
bursts via a stateless, horizontally-scaled API plus Redis-served hot reads. The
one isolation that earns its keep — ingestion — is the one we make.

## Decisions Ledger

Domain decisions resolved with this ADR. Each row notes the rejected alternative.

| # | Decision | Chosen | Rejected alternative |
|---|----------|--------|----------------------|
| D1 | **Lock granularity** | One `round.quali_start` timestamp; whole round locks at once | Per-class lock derived from each class's session — unnecessary complexity since quali opens at one time |
| D2 | **Salary cap model** | Fixed per-round cap; rosters fully independent round to round | Season-long bankroll / transfer budget — stateful and a poor fit for churning entry lists |
| D3 | **Pickable entities** | Polymorphic `entity_type` (CAR \| DRIVER) + `entity_id` | Table-per-type — more schema sprawl for uniform picks |
| D4 | **Price integrity** | Snapshot `price_at_lock` onto each pick | Recompute cap against live price — would let later price changes invalidate locked rosters |
| D5 | **Roster composition** | Per-`(season, class, slot)` `roster_rule`, enforced only for classes with a session that round | Hardcoded per-championship rules; or enforcing all season rules every round (breaks when a class sits out) |
| D6 | **Scoring** | Versioned, data-driven rules engine; class-relative ranking → shared points table; MAIN from qualifying, IMPACT from race fastest lap | Hardcoded scoring — every rule change becomes a code deploy and breaks reproducibility |
| D7 | **Scoring cadence** | Two phases per round (MAIN at quali publish, IMPACT at race publish); `round_total` is a running sum | Single end-of-weekend scoring — blocks quali points on race data and hides the mid-weekend leaderboard move |
| D8 | **Result corrections** | Idempotent re-score keyed by `(pick_id, rule_version)`; corrections flow through mandatory admin approval | Trust automated feeds live — penalties/DSQs would publish wrong scores |
| D9 | **Source of truth / cache** | Postgres authoritative; Redis for hot reads, countdown, leaderboard sorted sets | Cache-as-truth — divergence risk on the leaderboard |

> **Amendment (2026-06-16):** For the MVP, **Redis is deferred**. Postgres backs
> the leaderboard (`round_total` + index) and Hangfire job state; hot reads use an
> in-process cache; the lock countdown is computed client-side from `quali_start`.
> Redis (Upstash serverless, to fit the bursty between-races profile) is
> reintroduced only when multi-instance shared caching or leaderboard performance
> demands it. D9's principle is unchanged — Postgres remains authoritative. See
> [data-model.md](../data-model.md#derived-state-not-in-the-relational-model).

> **Amendment (2026-06-19) — D5 per-round overrides:** `roster_rule` gains a nullable
> `round_id`. A NULL row is the season default (the original D5 model); a row with a
> `round_id` overrides that class's count for one round. The resolver prefers a round
> override over the season default per class. Rationale: car counts per class shift
> across a season's entry lists, so a fixed per-season composition is too rigid. "Enforced
> only for classes with a session that round" (D5) is unchanged — Sessions still gate
> which classes run; this only makes the *counts* per-round-tunable.

## Consequences

**Easier:**
- The lock + cap + composition check is a single Postgres transaction — the
  highest-integrity path is also the simplest to verify.
- Scoring changes ship as data (new ruleset version), not code; every total is
  reproducible via its stamped `rule_version`.
- Result corrections (the common case in sportscar racing) re-run through one
  idempotent, admin-gated path.
- Low, predictable operating cost; small on-call surface.

**Harder:**
- Polymorphic pick entities (D3) lose DB-level foreign-key integrity → requires
  app-layer validation plus a periodic integrity job.
- Redis leaderboards (D9) require a rebuild-from-Postgres job to guarantee
  consistency after recomputes.
- A future heavyweight scoring model would need extraction from the monolith.

**To revisit:**
- Re-evaluate distribution only past ~100k DAU or if scoring compute grows heavy.
- Move lock to per-class granularity only if product wants later-class editing
  after an earlier class's qualifying starts (D1).
- Add Postgres sharding only if the single primary becomes a bottleneck (not
  expected at target scale).

## Action Items

1. [ ] Stand up schema: championship / season / class / round / session / car_entry / driver / entity_price / registration / roster_rule.
2. [ ] Implement the transactional `PUT roster` (lock + cap + composition) as the integrity-critical path, with tests for each rejection mode.
3. [ ] Build the isolated ingestion service with a mandatory admin approve/override step before results go live.
4. [ ] Implement the versioned scoring engine (MAIN + IMPACT) and the idempotent re-score path keyed by `(pick_id, rule_version)`.
5. [ ] Wire Redis leaderboards plus a rebuild-from-Postgres reconciliation job.
6. [ ] Add monitoring: failed/late ingestion before race end, any successful write after `quali_start` (correctness alarm), scoring-job lag, leaderboard/Postgres divergence.
