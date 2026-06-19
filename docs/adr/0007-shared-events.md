# ADR-0007: Shared Events (a weekend many championships opt into)

**Status:** Proposed
**Date:** 2026-06-19
**Related:** [ADR-0001](0001-core-architecture.md) (D2, D5), [ADR-0002](0002-lock-model.md), [data-model.md](../data-model.md)

## Context

A `round` today is "a race weekend / event" scoped to **one** season of **one**
championship ([data-model.md](../data-model.md): `round.season_id`). But IMSA runs
multiple championships on the **same physical weekend, at the same circuit** — e.g.
WeatherTech and Pilot Challenge both race at Sebring on one weekend, with **different
qualifying times** for each series.

Under the current model that weekend is **N independent `round` rows**, one per
championship, that happen to share a name and circuit but are otherwise unrelated. This
is correct for the pick/score pipeline — each series genuinely has its own qualifying
time, cars, prices, and results — but it has two costs:

- **Management friction.** An admin re-enters the same weekend's name/circuit/dates once
  per championship, with no link between the copies.
- **The UI has no shared weekend to render.** A cross-championship calendar ("what's
  racing this weekend") would have to **de-duplicate rounds by name/circuit in the client**
  to collapse the N copies back into one weekend — fragile, and a join the database should
  own. (Today's Landing sidesteps this by only ever showing **one active championship's**
  rounds; the dedup pain is latent, and blocks a unified calendar.)

The key observation that shapes this ADR: **`round` is already the right unit for
everything except the shared-weekend identity.** Sessions, prices, rosters, picks, scores,
`round_total`, leaderboards, and crucially the **`quali_start` lock boundary** (ADR-0002)
all hang off `round`. And `quali_start` is **already per-round** — which is exactly the
"each championship opts in with its own qualifying time" requirement. So we do not need to
restructure `round`; we need a **parent** above it that represents the physical weekend.

## Decision

Introduce a first-class **`event`** entity: the physical race weekend at a circuit, shared
across championships. A championship "opts into" an event by having a `round` (in one of its
seasons) point at that event. The round keeps its own `quali_start` — its per-championship
qualifying time — and everything else it owns today.

### What changes, in one picture

```
BEFORE                                  AFTER
  season ──< round (the weekend)          season ──< round >── event (the weekend)
            └ quali_start                           └ quali_start (per championship, unchanged)
            └ name, circuit, dates                  event: name, circuit, starts_at, ends_at

  Sebring weekend = 2 unrelated rounds    Sebring weekend = 1 event, 2 rounds opted in
  (WeatherTech, Pilot Challenge)          (WeatherTech round, Pilot Challenge round)
```

### D1 — `event` is a top-level calendar entity

```sql
event(id, name, circuit, starts_at, ends_at)
```

An event is **not** scoped to a championship or season — that is the whole point; it spans
them. It carries the **shared** weekend identity (name, circuit, weekend bounds). Ordering a
cross-championship calendar is by `event.starts_at`. (We deliberately do **not** add a
`season`/`year` grouping column now — `starts_at` already implies the year, and IMSA's
calendar is a single shared schedule. Add a grouping dimension only if a real need appears —
see *To revisit*.)

### D2 — `round` gains a nullable `event_id`, and is otherwise unchanged

```sql
round.event_id  bigint NULL  FK → event
```

- **Nullable** so existing rounds remain valid and a round can exist before it is attached to
  an event (and a one-off weekend with a single championship needn't have one).
- **`round` keeps `quali_start`, `salary_cap`, `sequence`, sessions, prices, picks, scores.**
  The per-championship qualifying time the requirement asks for is the `quali_start` round
  already has. Nothing about lock (ADR-0002), composition (ADR-0001 D5), or scoring moves.
- The entire results / scoring / `round_total` / leaderboard pipeline is **untouched** — it
  only ever references `round`, and `round`'s shape is preserved. This is what makes the
  change additive rather than a migration of the hot path.

### D3 — `RoundDto` keeps exposing `name` / `circuit` (no frontend round-consumer changes)

Display identity (`name`, `circuit`, and the weekend bounds) conceptually belongs to the
**event** now. But every existing frontend round consumer — Landing, Pick, Dashboard,
Standings — reads `round.name` / `round.circuit` / `round.startsAt` today. To keep this
change additive on the client, **`RoundDto` continues to expose `name`/`circuit`/dates**,
sourced from the linked event when one exists and from the round's own columns otherwise.

Concretely for the MVP we **keep `name`/`circuit`/`starts_at`/`ends_at` columns on `round`**
(no destructive drop) and treat the event as the **authoritative shared copy** that the admin
edits; round columns are a denormalized display cache the DTO reads. This avoids touching any
round-consumer component now. Normalizing the columns *off* `round` later is a follow-up, not
a blocker (see *To revisit*). The net rule: **`RoundDto`'s contract does not change** — only
new event surfaces are added.

### D4 — A new `event` API surface; round create/update references an event

```
GET    /events            → list events (each with its participating rounds:
                            [{ roundId, championship, season, qualiStart }]) — public
GET    /events/{id}       → one event + its rounds — public
POST   /events            → create  — Admin
PUT    /events/{id}       → update  — Admin
DELETE /events/{id}       → delete  — Admin (only if no rounds reference it, else 409)
```

`CreateRound` / `UpdateRound` gain an optional **`eventId`**. Attaching a round to an event is
how a championship "opts in." The cross-championship calendar the UI wants is now a single
`GET /events` read — **the dedup the client would otherwise do lives in the query**, keyed on
a real FK instead of string-matching names. Catalog reads are already public (CLAUDE.md), so
`event` reads follow the same public/admin split as `round`.

### D5 — Migration is additive and dev data is disposable

`event_id` is **nullable**, so existing `round` rows are valid the instant the column lands —
no data is required to move. Backfill is a convenience, not a correctness requirement:
optionally create one `event` per distinct `(name, circuit, weekend)` and link rounds to it.
Per [CLAUDE.md] the dev database is disposable (`docker compose down -v` + re-`database
update` + re-seed), so for development we **re-seed** rather than write careful backfill SQL;
the seed scripts gain events and link rounds to them.

## Options Considered

### Option A: `event` parent above an unchanged `round` (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — one new table, one nullable FK, one new endpoint group |
| Blast radius | Minimal — pick/score/leaderboard pipeline untouched; `RoundDto` contract preserved |
| Correctness | High — per-championship `quali_start` already exists; lock model unchanged |
| UI payoff | High — cross-championship calendar is one `GET /events`, no client dedup |

**Pros:** Additive migration (nullable FK); the expensive, correctness-critical hot path
(lock, scoring, totals) is not touched because `round` is preserved; the per-championship
qualifying-time requirement is satisfied by the `quali_start` round already has; the dedup the
client would do becomes a DB join on a real FK.
**Cons:** `name`/`circuit` are denormalized across `event` and `round` for the MVP (a display
cache), to be normalized in a later pass; one new admin screen (Events) to build and maintain.

### Option B: Restructure — make `round` a child of `event` and move all display fields up

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Blast radius | Wide — every round consumer reads display via `event` |
| Correctness | High |
| UI payoff | High |

**Pros:** Cleanest normalization — one home for name/circuit/dates, no denormalized copy.
**Cons:** `RoundDto` loses `name`/`circuit`, so **every** frontend round consumer (Landing,
Pick, Dashboard, Standings) changes for **no user-facing gain** over Option A. Deferred, not
rejected: it is the natural follow-up once the event model has settled (see *To revisit*).

### Option C: Keep N rounds; de-duplicate weekends in the client

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low (no backend) |
| Blast radius | UI only |
| Correctness | Fragile — dedup key is a string |
| UI payoff | Low |

**Pros:** No schema or API change.
**Cons:** The "is this the same weekend" join is done in the client by matching names/circuit
across championships — exactly what the user wants to avoid. No shared entity to hang event
images, descriptions, or a canonical weekend page off later. Rejected — it pushes a
relationship the database should own into every consumer, forever.

## Trade-off Analysis

The decision hinges on **where the shared-weekend identity lives.** It is not a property of
any one championship's round (Option C leaves it implicit in matching strings) and it does not
require reshaping the unit the whole pick/score pipeline is built on (Option B pays that cost
for normalization the MVP doesn't need yet). It is a **parent** that rounds opt into — Option
A's single table and nullable FK. Crucially, the requirement that drove this — "each
championship with its own qualifying time" — needs **no new mechanism at all**: `quali_start`
is already per-round. So Option A buys the shared-calendar capability and removes the admin
duplication while leaving the lock, scoring, and totals machinery — the parts that are
expensive to get right — completely alone. Keeping `RoundDto` flat (D3) means the payoff
arrives with new code (event surfaces) rather than edits to working round consumers.

## Consequences

**Easier:**
- A cross-championship calendar / "what's racing this weekend" page is a single `GET /events`
  with no client-side dedup.
- An admin enters a weekend's identity **once** (the event); each championship opts in by
  attaching a round.
- A natural home appears for future per-weekend assets (event hero image, blurb, canonical
  weekend page) without touching `round`.

**Harder:**
- `name`/`circuit` are denormalized between `event` (authoritative) and `round` (display
  cache) for the MVP; the admin event edit must keep the round cache in sync (or the DTO reads
  through the event at query time — an implementation choice in D3).
- One new admin screen (Events) and the round create/update form gains an event selector.
- `DELETE /events` needs a guard (reject if rounds still reference it) to avoid orphaning the
  FK.

**To revisit:**
- **Normalize display fields off `round` (Option B follow-up):** once the event model has
  settled, drop `name`/`circuit`/dates from `round` and have `RoundDto` read them through the
  event, removing the denormalized cache. Deferred to keep this change additive.
- **A grouping dimension on `event`** (e.g. a platform `season`/`year`) — omitted now since
  `starts_at` implies the year and IMSA's calendar is a single shared schedule. Add if a real
  multi-calendar need appears.
- **Whether `round.sequence` should be complemented by event ordering** — sequence stays
  per-season for the per-championship calendar; the cross-championship calendar orders by
  `event.starts_at`. Revisit only if a season's round order and the weekend chronology ever
  diverge.

## Action Items

1. [ ] Schema: add `event(id, name, circuit, starts_at, ends_at)` and nullable
   `round.event_id` FK → event. Keep `round.name`/`circuit`/`starts_at`/`ends_at` (display
   cache, D3). Migration is additive (nullable FK) — no data move required.
2. [ ] Domain: `Event` entity; `Round.EventId` + `Round.Event` nav; EF config in
   `FantasyDbContext` (snake_case convention, FK).
3. [ ] Endpoints: new `EventEndpoints` — `GET /events` (with participating rounds) +
   `GET /events/{id}` public; `POST`/`PUT`/`DELETE` Admin; `DELETE` rejects (409) if any round
   references the event. Annotate response schemas (`.Produces<EventDto>()`).
4. [ ] `RoundEndpoints`: `CreateRound`/`UpdateRound` accept optional `eventId` (validate the
   event exists when supplied). **`RoundDto` contract unchanged** — keeps `name`/`circuit`/
   dates (D3).
5. [ ] API contracts: regenerate the frontend client (`pnpm gen:api`) for the new `EventDto`.
6. [ ] Frontend (admin): an **Events** management screen (list/create/edit) and an event
   selector on the round create/edit form. Existing per-round admin (Catalog/Entries/Prices)
   unchanged.
7. [ ] Frontend (player): wire the (future) cross-championship calendar to `GET /events`;
   existing Landing/Pick/Dashboard/Standings need **no change** (D3).
8. [ ] Seed: update `seed_dev_board.py` to create events and link rounds to them (re-seed, not
   backfill — D5).
9. [ ] Docs: add `event` + `round.event_id` to [data-model.md](../data-model.md); index this
   ADR in [docs/README.md](../README.md).
