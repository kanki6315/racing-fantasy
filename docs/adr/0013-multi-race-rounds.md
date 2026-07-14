# ADR-0013: Multi-race rounds (one round, N scored races)

**Status:** Accepted (2026-07-14)

## Context

Sprint series score more than one race per weekend — Whelen Mazda MX-5 Cup runs two — but the
model assumed exactly one race per round: `session` was unique on `(round_id, class_id, type)`,
ingestion and scoring collapsed race results into per-class dictionaries (a second race session
would throw), and a `score` row's only discriminator was its source, so a pick could hold at most
one `RACE_POSITION` row. Alternatives considered: one round *per race* (rejected — doubles pick
management and needs a per-race lock story; an MX-5 weekend has one qualifying that sets the
whole weekend) and folding both races into a single summed `R` score (rejected — players couldn't
see the per-race split).

## Decision

1. **One round, N race sessions** — one pick set, one lock (`round.quali_start`, unchanged;
   ADR-0002). `session.race_number` (int, NOT NULL, default 1) distinguishes races; the unique
   key becomes `(round_id, class_id, type, race_number)`. Qualifying must stay `race_number = 1`
   (validated at the session API) so per-class quali lookups stay single-valued. Display labels
   are derived, never stored: `R{n}`, shown as plain `R` on single-race rounds.
2. **Per-race score rows** — `score.session_id` (nullable FK; NULL for Bonus/modifier rows) ties
   a position score to the session that earned it. The pick-owned idempotency key becomes
   `(pick_id, source, session_id)` **NULLS NOT DISTINCT** (legacy rows with no resolvable session
   still dedupe per pick+source). `score_audit.session_id` records which race a change touched.
   The migration backfills every existing pick-owned score to its session (deterministic
   pre-multi-race: one session per round/class/type).
3. **Same points table per race** — the season's Active `RACE_POSITION` ruleset prices each race
   session independently (P1 in R1 = P1 in R2). No ruleset model or admin changes.
4. **Ingestion targets a race** — the race-results and race-fastest-laps imports take
   `?raceNumber=` (default 1); a class with no session for that number surfaces as per-row
   issues, never a guess. `IngestResponse` echoes the target.
5. **Stale-score cleanup (scoring engine)** — a recompute now *deletes* any owned `score` row it
   did not re-emit, audited as `"removed"` (old points → 0). Guards: pick-owned rows only for
   position sources with an Active ruleset (a deactivated ruleset doesn't wipe history);
   modifier-owned rows only for kinds with a registered scorer. This fixes a pre-existing bug —
   results corrected away left orphan points forever — and mops up any backfill leftovers, so it
   must deploy together with the migration.
6. **Server-derived race count** — the admin scores and player picks responses carry
   `raceCount` (max race number in the round, min 1) and each `SourceScoreDto` carries
   `raceNumber`, so clients label R1/R2 without inferring multi-race from sparse score data.

## Consequences

- Roster modifiers (DOUBLE_POINTS_TEAM / CAPTAIN) double the pick's full MAIN total — now
  Q+R1+R2 on a multi-race weekend — with no code change (`BasePoints` already summed all rows).
  Worth a player-facing note.
- `round_total`, leaderboards, movement, and `GET /rounds/{id}/stats` are sum-based and needed
  no changes; movement granularity stays the round (two races in one weekend = one ▲▼ step).
- Admin UI: Catalog → Sessions gets a Race # field/label; Results shows an R1/R2 target selector
  only when the round has a race numbered > 1 (single-race rounds are visually unchanged).
- Reverting the migration fails if any round already has two race sessions for one class —
  delete the extra sessions (and their results/scores) first.
- Lock, reminders, pricing, and the entry-list import are round/event-level and unaffected — a
  two-race weekend still has one board, one price set, one lock, one reminder pair.
