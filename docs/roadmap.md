# Build Order / Milestone Plan — Endurance Fantasy League

**Status:** Accepted
**Date:** 2026-06-16
**Related:** [ADR-0001](adr/0001-core-architecture.md), [ADR-0002](adr/0002-lock-model.md), [ADR-0003](adr/0003-scoring-rules-engine.md), [data-model.md](data-model.md)

Sequences every ADR action item into shippable phases. The ordering follows the
dependency chain: you can't take picks without a catalog and prices, can't score
without ingested results, can't rank without scores.

> **Progress (2026-06-18): P0–P5 complete and tested on real IMSA data; P6 deferred** (the only
> unbuilt stage — see below). Note ADR-0006 superseded the IMPACT slot with free per-round **roster
> modifiers** (P4's "IMPACT scoring" line is dormant; `RaceFastestLap` retained but unused). Frontend
> F4/F5 work added small backend pieces beyond these phases — `isAdmin` on `/auth/me`, `.Produces<>`
> response-DTO annotations across the admin endpoints, **image upload** (presigned S3 PUT + CloudFront,
> keyed by `CarEntry.Id`), and the `GET /rounds/{id}/prices` `PriceItem` gaining each car's **driver
> lineup + race number** (so the pick board shows who drives each team and orders by number); see
> [frontend-roadmap.md](frontend-roadmap.md) and AGENTS.md.

## Critical path

```
P0 Foundations ─► P1 Catalog & Registration ─► P2 Economy + Picks + LOCK ─┐
                                                                          │
   P3 Ingestion ──────────────────────────────────────────────────────►──┤
                                                                          ▼
                                          P4 Scoring ─► P5 Leaderboards ─► P6 Hardening
```

P2 (the integrity core) and P3 (ingestion) can proceed in parallel once P1 lands —
ingestion has no dependency on the pick path. P4 needs both.

---

## Phase 0 — Foundations

**Goal:** schema, auth, and a deployable skeleton exist.

- [ ] Stand up Postgres; migration tooling. (Redis deferred — see MVP note below.)
- [ ] Create the full schema from [data-model.md](data-model.md) (all tables, constraints, indexes).
- [ ] `app_user` + authentication/session.
- [ ] Stateless API skeleton + background worker runtime + CI/CD + a deploy environment.

**Exit:** migrations apply cleanly; a user can sign up and log in; CI is green.

## Phase 1 — Catalog & registration

**Goal:** the season structure exists and users can opt into championships.

- [ ] Admin CRUD for `championship` / `season` / `class` / `round` / `session` (incl. `round.quali_start`).
- [ ] `car_entry`, `driver`, `entry_driver` lineup management.
- [ ] `roster_rule` authoring (per-class MAIN minimums; class-agnostic IMPACT bounds via `class_id = NULL`; per-round overrides via nullable `round_id` layered on the season default — see [data-model.md](data-model.md)).
- [ ] `registration` flow with per-season `salary_cap` (ADR-0001 D2); `GET /championships`, `POST .../register`.

**Exit:** an admin can build a full season; a user can register for a championship and see its rounds.

## Phase 2 — Economy + picks + LOCK  *(integrity core)*

**Goal:** users build a legal, capped roster that freezes correctly at qualifying.
This is the highest-stakes phase — most test effort lives here.

- [ ] `entity_price` per round; `GET /rounds/{rid}/prices` (in-process `IMemoryCache` for the spike).
- [ ] **Transactional `PUT roster`**: lock + cap + composition validated atomically (ADR-0002, ADR-0001 D4/D5).
  - [ ] `409 Locked` at/after `quali_start`.
  - [ ] `422` with per-class composition violations named.
  - [ ] composition scoped to classes with a `session` that round (D5).
  - [ ] `price_at_lock` snapshot semantics (D4).
- [ ] **Lock-sweep worker**: stamp `locked_at`, snapshot prices, mark immutable; idempotent (ADR-0002).
- [ ] Client-side countdown computed from `quali_start`, documented as **UX-only / non-authoritative**.
- [ ] Tests: before / exactly-at / after boundary; concurrent writes racing the lock; sweep idempotency; cap and each composition rejection mode.

**Exit:** a roster can be built, validated, and saved before lock, and is provably
un-editable at/after `quali_start`.

## Phase 3 — Results ingestion  *(parallelizable with P2 after P1)*

**Goal:** qualifying and race-fastest-lap data lands cleanly and correctably.

- [ ] Isolated ingestion service (ADR-0001): feed/PDF/manual adapters → **staging**.
- [ ] **Mandatory admin approve/override** step before results go live (ADR-0001 D8).
- [ ] Populate `quali_result` (per car) and `race_fastest_lap` (per driver).
- [ ] Emit `results.published(session, revision)` events.
- [ ] Re-ingest path for corrections (penalties/DSQs) re-emits the event.

**Exit:** an admin can ingest, review, and publish results for a session, and
re-publish a correction.

## Phase 4 — Scoring engine

**Goal:** picks turn into points, in two phases, reproducibly.

- [ ] `scoring_ruleset` / `position_points` / `scoring_bonus`; admin authoring + versioning (ADR-0003).
- [ ] **MAIN** scoring (class-relative qualifying rank; driver picks resolve via lineup).
- [ ] **IMPACT** scoring (class-relative race fastest-lap rank).
- [ ] Two scoring events wired to the worker; `round_total` maintained as a running sum (ADR-0003 D7).
- [ ] **Idempotent recompute** keyed by `(pick_id, rule_version)` + `score_audit` rows (ADR-0003 D8).
- [ ] `GET /rounds/{rid}/scores`.
- [ ] Tests: class-relative ranking, two-phase running totals, recompute after a simulated DSQ, reproducibility under a version bump.

**Exit:** MAIN points appear after quali publish, IMPACT after race publish, and a
corrected result re-scores cleanly with an audit trail.

## Phase 5 — Leaderboards & standings

**Goal:** rankings, fast and consistent.

- [ ] **MVP:** leaderboard from `round_total` with an index + `ORDER BY` (materialized view if needed); refreshed each scoring phase.
- [ ] `GET /seasons/{id}/leaderboard`, season standings.
- [ ] **Later (only if load needs it):** Redis sorted sets `ZADD`'d from `round_total`, plus a reconciliation job rebuilding them from Postgres after any recompute (ADR-0001 D9 amendment).

**Exit:** leaderboards update within seconds of each scoring phase and survive a
recompute without drift.

## Phase 6 — Observability & hardening — **DEFERRED**

> **Deferred 2026-06-17.** Production-hardening with no production, no users, and no
> frontend yet — every item is gated on a deployment + alerting stack that doesn't
> exist, or on real user load that can't be estimated pre-launch. None affects
> correctness (lock, cap, composition, idempotent scoring are enforced and tested).
> Revisit a trimmed subset (lock-write alarm, ingestion-lag alarm, a page of
> runbooks) when approaching a real deployment with users; the rest stays gated on
> load.

**Goal (when resumed):** the system is operable and the integrity alarms are live.

- [ ] Alarms: failed/late ingestion before a known race end; **any successful roster write at/after `quali_start`** (pages immediately); scoring-job lag; leaderboard/Postgres divergence.
- [ ] Nightly polymorphic-reference integrity job (orphan `pick`/`entity_price` — ADR-0001 D3).
- [ ] Load test the lock spike (`PUT roster` + `/prices` + countdown under burst).
- [ ] If load warrants: introduce Redis (Upstash serverless) for shared cache + leaderboard sorted sets; add a read replica for standings reads; cache-invalidation review.
- [ ] Runbooks: re-score, leaderboard rebuild, lock-time correction.

**Exit:** dashboards and alarms cover the integrity-critical paths; the lock spike
is load-verified; on-call has runbooks.

---

## Suggested MVP cut

To get a single championship playable end-to-end fastest, ship **P0 → P1 → P2 →
P3 → P4 → P5** for **one** championship (e.g. WeatherTech), with P6 alarms for the
lock-write and ingestion-lag cases pulled forward into P2/P3 rather than deferred.
Defer multi-championship breadth, bonus rules beyond a position table, and the
read replica until the first season has run.

## Cross-ADR action item coverage

| Source | Items | Phase |
|---|---|---|
| ADR-0001 | schema, transactional PUT, ingestion+admin, scoring engine, leaderboards+reconciliation, monitoring, integrity job | P0–P6 |
| ADR-0002 | quali_start, transactional lock, sweep worker, UX countdown, lock-write alarm, boundary tests | P2, P6 |
| ADR-0003 | ruleset schema, MAIN+IMPACT scoring, two-phase events, idempotent recompute+audit, leaderboard rebuild, seed ruleset, scoring tests | P4, P5 |
