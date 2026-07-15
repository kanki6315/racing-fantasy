# ADR-0008: Multi-championship calendar & the event-level pick-release gate (`picks_open`)

**Status:** Accepted
**Date:** 2026-06-19
**Related:** [ADR-0007](0007-shared-events.md) (events), [ADR-0002](0002-lock-model.md) (lock), [data-model.md](../data-model.md)

## Context

The backend has always been FK-scoped per championship (championship → season →
round → registration), but the **player UI silently collapsed to one championship.**
Every player surface funnelled through `useActiveSeason()`, which returned the first
championship (alphabetical) that had a season. Adding a second series either hid it or —
if it sorted earlier alphabetically — hijacked the whole UI.

The product intent is the opposite: **championships run concurrently and a player may
follow only a support series**, never registering for the headline one. The Landing
calendar should show every series' weekends (which [ADR-0007](0007-shared-events.md) now
makes a single `GET /events` read), and "which weekend can I pick for" must be a real,
server-owned fact — not a client heuristic.

Two questions had to be answered:

1. **Sort order.** Alphabetical is wrong (a support series shouldn't outrank the
   headline one just by name). We need a stable, admin-controlled ordering used
   everywhere championships are listed.
2. **"Open for picks" was an illusion.** The first calendar cut marked exactly one
   event open — the soonest future weekend (`[0]` after sorting by quali). That is an
   artifact of the array index, can't represent multiple open weekends, and is not the
   server's truth (the real lock is per-round at `quali_start`, ADR-0002). It also
   conflated "scheduled" with "board released" — a future weekend whose entry lists /
   prices aren't published yet is not pickable.

## Decision

### D1 — Decouple the player UI from a single "active" championship

- **Championship `sort_order`** (int, column `sort_order` to dodge the SQL reserved word;
  exposed to clients as `order`). `GET /championships` orders by it then name; it is the
  constant sort key everywhere championships are listed (calendar series pills, leaderboard
  filter, admin lists).
- **Landing calendar is purely Event-API driven** — every event, every series, no
  `active`-championship dependency. (Standalone rounds with no event don't appear; the
  convention is to attach pickable rounds to an event — ADR-0007.)
- **Registration call-out keys off *any* registration in *any* series** (was: not
  registered for the active season). A support-series-only player isn't nagged to enter
  the headline championship.
- **Leaderboards** gain a **Championship → Year → Round** filter hierarchy, replacing the
  single active-season anchor. The Total | round sub-filter is shared with league boards
  (new `?roundId=` on the league leaderboard endpoint).

### D2 — Pick-release is an **event-level boolean** (`event.picks_open`), not a timestamp

A weekend's pick board opens **once all its series' entry lists are published**, and the
product rule is to **open every championship's picks for that weekend at the same time.**
So the release signal lives on the **event**, as a boolean an admin toggles:

```sql
event.picks_open  boolean NOT NULL DEFAULT false
```

`picks_open` is a **gate, not the whole status** — it governs only the *release* (COMING
SOON → PICKS OPEN). **Locking stays per-round and automatic at `quali_start`** (ADR-0002),
untouched. The two compose:

```
now ≥ latestQuali        → LOCKED        (time wins; terminal)
else !picks_open         → COMING SOON
else now < earliestQuali → PICKS OPEN
else                     → PICKS CLOSING (a shared weekend mid-qualifying: some series locked)
```

Because openness is per-event, **any number of weekends can be open at once** — the `[0]`
artifact is gone.

### D3 — Enforce `picks_open` on the server, surface it to the client

- **Roster PUT** rejects a save when the round's event is closed:
  `409 { error: "not_open" }` (after the quali-lock check). A round with no event has no
  gate; the quali lock still applies.
- **Roster GET** returns `picksOpen` so the pick page **disables upfront** (a neutral
  "PICKS NOT OPEN" state, distinct from the red quali "LOCKED"), instead of letting a user
  build a lineup that fails on save.

## Options Considered (D2)

### Option A — Event-level boolean `picks_open` (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — one boolean column, one admin toggle |
| Fit to workflow | High — matches "open the whole weekend once entry lists are in" |
| Multiple-open | Native — each event independent |

**Pros:** Decouples *release* from *lock* cleanly; one toggle opens all series on a weekend
together; supports any number of open events; server-authoritative. **Cons:** Manual — a
forgotten toggle means picks never open (mitigated with an OPEN indicator on the admin
Events list).

### Option B — Per-round `picks_open_at` timestamp (rejected)
**Pros:** Automatic, no manual flip. **Cons:** Pick-readiness depends on **entry-list
publication, which varies per round** — there is no reliable timestamp to set, and a
per-round timestamp fights the product rule that a weekend's series open *together*. A
timestamp encodes a precision the domain doesn't have.

### Option C — Derive "open" from published prices (rejected)
**Pros:** No new field. **Cons:** N price-board probes per calendar render; fragile; still
can't express the admin's "release now" intent as a first-class fact.

## Consequences

**Easier:** A genuinely multi-series calendar; "is this weekend pickable" is one boolean the
admin owns; multiple concurrent open weekends just work; the pick page can gate before a
wasted save.

**Harder:** `picks_open` is manual — needs a visible admin affordance (done: OPEN badge on
the Events list) and ideally a "still closed near first quali" warning. The calendar drops
standalone (no-event) rounds by design.

**To revisit:**
- A soft admin warning when an event is still closed within N days of its first quali.
- Series-specific registration call-outs (the calendar shows all series; registration still
  defaults to the order-first season).
- Per-series status on a shared weekend's badge (today the event badge is an aggregate;
  PICKS CLOSING already signals the split-lock window).

## Action Items

1. [x] Schema: `championship.sort_order` (migration `AddChampionshipOrder`);
   `event.picks_open` (migration `AddEventPicksOpen`). Both additive, default 0 / false.
2. [x] API: `ChampionshipDto`/create/update gain `order`; `GET /championships` ordered.
   `EventDto`/create/update gain `picksOpen`; admin Events toggle. `EventRoundDto` carries
   `championshipOrder`.
3. [x] Enforcement: roster PUT → `409 not_open` on a closed event; roster GET returns
   `picksOpen`. League leaderboard endpoint gains `?roundId=`.
4. [x] Frontend (player): event-driven Landing calendar with the D2 status machine + a
   "PICKS CLOSING" tooltip; registration keyed off any registration; pick page disables on
   `picksOpen === false`; leaderboard Championship → Year → Round filters (shared
   `RoundFilter`).
5. [x] Frontend (admin): Order field on the Championship form; `picks_open` toggle + OPEN
   badge on the Events screen.
6. [x] Docs: this ADR; `championship.sort_order` + `event.picks_open` in
   [data-model.md](../data-model.md); index in [docs/README.md](../README.md).

## Amendment (2026-07-14): Event lifecycle status

**Problem.** `event.picks_open` is a single boolean asked to express a whole lifecycle, and it was the
*only* thing gating the player Dashboard. `picks_open = false` ambiguously meant both "not opened yet"
and "closed", so in production every weekend an admin ever opened stayed on the Dashboard forever, and
the card's "Picks Open" badge was hardcoded — it kept claiming PICKS OPEN even after the per-round quali
lock had passed (the row-level lock is computed separately from `quali_start`).

**Decision.** An event now has a **five-stage lifecycle**, and the display status is **derived**, not
stored — time drives the open→locked transition automatically, and two new **manual, event-level** admin
flags cover what time can't:

| Status | Driven by | Dashboard | Badge |
|---|---|---|---|
| Waiting to Open | `!picks_open && now < firstQuali` | hidden | — |
| Picks Open | `picks_open && now < firstQuali` | shown | green "Picks Open" |
| In Progress | `now >= firstQuali` (**first** round to lock) | shown | amber "In Progress" |
| Scored | `scored` flag (manual) | shown | blue "Scored" |
| Closed | `finalized` flag (manual) | hidden | — |

Precedence (top wins): `finalized` → `scored` → first round locked → `picks_open` → waiting.

- **In Progress is purely time-derived and ignores `picks_open`** — so an admin toggling picks off *after*
  quali can neither hide the event nor revert the badge to "open". We deliberately did **not** add a "was
  ever released" signal; the only case not covered is an admin opening then closing picks *before* quali
  (a rare deliberate pause → returns to Waiting/hidden), which is acceptable.
- **`scored` / `finalized` are event-level and display-only.** They do **not** gate leaderboards or
  scoring (standings stay live once scored — the separate deferred publish-gate gap). Event-level because
  a shared weekend's races publish at different times; the admin flips `scored` once all are in.
- The `picks_open` reminder-window logic (`picks_opened_at`, ADR-0009) is unchanged.

**Implementation.**
1. Schema: `event.scored` + `event.finalized` (migration `AddEventScoredFinalized`; both `bool NOT NULL
   DEFAULT false`).
2. API: `EventDto` / `CreateEvent` / `UpdateEvent` gain `scored` + `finalized`; `POST`/`PUT /events`
   persist them.
3. Frontend: a single shared `deriveEventStatus()` helper (`apps/web/src/lib/eventStatus.ts`) is the source
   of truth (status enum + `EVENT_STATUS_META` label/color + `SHOWN_ON_DASHBOARD`). The Dashboard filters
   on it and renders a live badge (ticks via `useCountdown` so it flips exactly at quali); the admin Events
   screen gains Scored/Finalized switches and a lifecycle badge. `useCreateEvent`/`useUpdateEvent`/
   `useDeleteEvent` now also invalidate the player-facing `['events']` cache.

**Not in scope:** the Landing calendar keeps its existing 4-state machine and still lists closed events
(it's a season calendar — only the Dashboard hides them); the helper is written so Landing can adopt it
later to remove the duplicated status logic. No leaderboard/scoring publish gating.
