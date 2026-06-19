# ADR-0002: Pick Lock Model

**Status:** Accepted
**Date:** 2026-06-16
**Related:** [ADR-0001](0001-core-architecture.md) (D1)

## Context

A user's picks for a round must **freeze the instant that round's qualifying
begins**. After that, no edits — additions, removals, or swaps — are permitted.
This boundary is the integrity of the game: a single pick that lands after
qualifying results are visible is cheating, and there is no graceful way to
detect or unwind it after the fact. So the lock must be **impossible to beat**,
not merely discouraged in the UI.

Two forces shape the model:

- **IMSA timing reality.** A round has multiple classes (GTP / LMP2 / GTD PRO /
  GTD), and each class can run its qualifying session at a different clock time.
  But **qualifying for the round opens at one time** — the classes are sequenced
  within a single qualifying window, not gated by independent open times. So
  "qualifying has begun" is a single, round-level fact.
- **Bursty writes.** Most users edit in the final minutes before lock, so the
  enforcement path sees a spike of concurrent `PUT roster` calls right at the
  boundary. The check must be cheap and race-free under load.

## Decision

Lock the **entire round at a single `round.quali_start` timestamp**. Enforce the
lock **server-side, inside the same transaction** that validates the salary cap
and roster composition, and back it with a **lock-sweep worker** that materializes
the freeze at the boundary.

```sql
round(id, season_id, name, circuit, sequence,
      quali_start,            -- THE lock boundary for the whole round
      starts_at, ends_at)
```

Enforcement on every `PUT roster`:

```
BEGIN;
  SELECT quali_start FROM round WHERE id = :rid;          -- authoritative time
  IF now() >= quali_start: ABORT 409 Locked;
  ... validate cap + composition, upsert picks ...
  UPDATE roster SET ... ;
COMMIT;
```

The client-side countdown (served from Redis) is **UX only** — it never gates the
write. The server clock and `quali_start` are the sole authority.

**Lock-sweep worker.** A job fires once per round at `quali_start`: it stamps
`roster.locked_at`, snapshots `price_at_lock` onto each pick (see
[ADR-0001](0001-core-architecture.md) D4), and marks rosters immutable. This is
defense in depth — even if a write somehow raced the timestamp check, the swept
state is the frozen record of truth, and `locked_at` gives us an audit trail for
"my pick didn't save" disputes.

Schedule changes (delays, red-flagged sessions) are handled as an **admin edit to
`quali_start` before the boundary**, not as a per-session derivation at read time.

## Options Considered

### Option A: Single round-level `quali_start` (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — one timestamp, one comparison |
| Correctness | High — single authoritative boundary, no per-class branching |
| Product flexibility | Sufficient — matches how IMSA opens qualifying |
| Team familiarity | High |

**Pros:**
- One comparison in the transaction; trivially race-free under the lock spike.
- Matches reality: qualifying opens once for the round.
- Easy to operate — delays are a single admin field edit.

**Cons:**
- No per-class editing window. A user cannot keep editing GTD picks after GTP
  qualifying has started (acceptable — quali opens together).

### Option B: Per-class lock derived from each class's session start

| Dimension | Assessment |
|-----------|------------|
| Complexity | High — lock time is a `min()`/lookup over sessions, per class |
| Correctness | Lower — more branching, more race surface at the boundary |
| Product flexibility | High — later-class picks stay editable longer |
| Team familiarity | Medium |

**Pros:** Maximum editing flexibility; picks for a class lock only when that class
runs.
**Cons:** The lock becomes a per-class computed value the validation must resolve
per pick; the enforcement transaction grows branchy exactly where it must stay
simple. Buys flexibility the sport's format doesn't call for.

### Option C: Client-enforced lock (countdown gates submission)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low (apparent) |
| Correctness | Unacceptable — trivially bypassed |
| Product flexibility | n/a |
| Team familiarity | High |

**Pros:** Simple to build.
**Cons:** Any client (or a replayed request) can submit after lock. Fails the one
requirement that cannot be compromised. Rejected outright; the countdown remains
as UX only.

## Trade-off Analysis

The decision trades **per-class editing flexibility (Option B) for a simple,
provably race-free boundary (Option A).** Because IMSA opens qualifying for the
round at a single time, the flexibility Option B buys is largely fictional — there
is no real window in which "GTP has started but GTD picks should stay open" is the
intended product behavior. Meanwhile the cost of Option B is paid in the exact
place we least want complexity: the high-contention enforcement transaction at the
lock spike.

Client enforcement (Option C) is a non-starter — the lock is a server-authority
concern by definition, since the threat model is a client that wants to submit
late.

So we take the single timestamp, enforce it transactionally on the server, and add
the sweep worker as a materialized backstop and audit anchor.

## Consequences

**Easier:**
- The integrity-critical write is a single timestamp comparison co-located with
  cap and composition checks in one transaction — easy to test exhaustively
  (before / at / after boundary).
- Schedule slips are a one-field admin edit.
- `locked_at` plus snapshotted `price_at_lock` give a complete, auditable record
  of every frozen roster.

**Harder:**
- No per-class editing windows; if product later wants them, this becomes a real
  schema and validation change (revisit below).
- The lock-sweep worker must be reliable and idempotent — a missed or
  double-fired sweep needs to be a no-op the second time and recoverable the
  first. Monitor it.

**To revisit:**
- Move to per-class locks (Option B) only if product explicitly wants later-class
  editing after an earlier class's qualifying begins.
- If clock skew between API nodes ever becomes a concern, source `now()` from the
  database (as written) rather than app servers — already the default here.

## Action Items

1. [ ] Add `quali_start` to `round`; backfill from the schedule.
2. [ ] Implement the transactional lock check inside `PUT roster`, returning `409 Locked` at/after the boundary.
3. [ ] Build the lock-sweep worker: stamp `locked_at`, snapshot `price_at_lock`, mark immutable; make it idempotent.
4. [ ] Expose the Redis-served countdown to clients as UX, explicitly documented as non-authoritative.
5. [ ] Add the correctness alarm: any successful roster write at/after `quali_start` pages immediately.
6. [ ] Tests: before / exactly-at / after boundary; concurrent writes racing the lock; sweep idempotency; admin `quali_start` edit before lock.
