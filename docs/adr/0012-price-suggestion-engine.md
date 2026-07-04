# ADR-0012: Admin price suggestion engine

**Status:** Proposed (2026-07-03)

## Context

Round pricing is fully manual: the admin types every price into the Prices screen
(`apps/web/src/routes/admin/Prices.tsx`), per round, per series. The only prior art is
`price_dev_board.py`'s mechanical per-class `base − rank × step` with rank = entry-id order.
Three constraints shape a suggestion engine:

- **No usable internal data at pricing time.** Prices are set *before* a round runs; for a series'
  first fantasy round mid-season there are no ingested results and no fantasy scores at all. Real
  championship points are not stored anywhere in the system. However, Al Kamel publishes official
  **POINTS DATA JSON** per series (teams standings one file per class, keyed by car number; driver
  standings one file, keyed by driver full name), with `position`, `total_points`,
  `net_position`/`total_net_points` (drops applied) and a full `points_by_session[]` breakdown.
- **Series differ by entity type and scale.** Team-based series (WeatherTech, Pilot Challenge)
  price cars only — drivers are never priced. Driver-based series (MX-5) price drivers only.
  Caps span ~$120M (IWSC) down to ~$1.0M with 2–3 driver picks (MX-5), so price granularity must
  vary per series. The Prices screen currently renders **car rows only**, so a driver-based series
  cannot be priced through the UI at all.
- **The admin must stay in control.** A form/points formula alone produces spacings the admin may
  not want (unwanted gaps, stale form); at season start there may be no data whatsoever. The
  ranking must be admin-ownable end to end.

## Decision

1. **Client-side only (v1); suggestions pre-fill, never persist.** The engine runs entirely in the
   Prices screen from data it already fetches (current + previous-round prices, roster rules for
   cap and composition). Generated prices land in the existing editable inputs as dirty rows and go
   through the existing review + `Save All` → `POST /rounds/{id}/prices` flow. Engine state
   (ranking, pins, knobs) is ephemeral — lost on refresh by design (localStorage as convenience,
   not contract). No new endpoints, no schema change.
2. **Pipeline:** *ranking → pinned curve → budget check → rounding.*
   - **Ranking (source of truth = the admin's ordered list per class).** Seeded best-available:
     imported points standings → previous-round prices → entry-list order. Rows reorder via
     drag / up-down arrows; every reorder reprices live.
   - **Pinned piecewise curve.** Within a class of N entries, price interpolates between *pins*:
     `price(rank r) = lo + (hi − lo) × ((n−1−r)/(n−1))^γ` per pinned segment, with the class top
     price and floor as default pins and a global steepness knob γ (1 = linear; >1 concentrates
     value at the top). The admin can pin any entry to an exact price; the curve re-interpolates
     between pins, giving local gap control without more global knobs. Pins survive regeneration;
     free-hand edits to inputs do not.
   - **Budget as target + live drift indicator, not forced renormalization.** The admin sets an
     affordability target α ("average legal roster ≈ α × salary cap", default 0.92), or an
     absolute total. Using the round's resolved composition (RosterRulesResolver), the panel shows
     live: `expected roster cost = Σ slots × class mean price` vs target. "Fit budget" scales the
     default (unpinned) anchors to hit the target; pins are absolute and never moved by fitting —
     drift from pinning is surfaced, not silently corrected.
   - **Rounding step knob** — 0.5 / 0.25 / 0.1 / 0.05, defaulting from cap magnitude
     (≈ cap/200 snapped): $120M → 0.5, $1.0M → 0.05. Floor pin clamps the bottom. Ties are legal.
3. **Points JSON import (the "championship situation" input).** A drop zone accepts one or more
   Al Kamel POINTS DATA files (downloaded by the admin — the host doesn't serve CORS, so no
   URL fetch), parsed client-side:
   - File kind is detected from shape (`team` field / numeric `key` = teams file; name `key` =
     drivers file) and auto-routed to a class by `championship.name` match where possible.
   - **Matching:** teams by `key` = car number within the class (`car_entry.number`); drivers by
     normalized full-name match against `driver.fullName` (the field ADR-0011's import populates).
     Unmatched rows and unmatched priced entities are listed as warnings; unmatched entities drop
     to the bottom of the ranking for manual placement (mirrors ADR-0011's warn-don't-guess rule).
   - Import seeds the **ranking** (official classification order) and enables
     **points-proportional spacing** as an alternative to the rank curve: price gaps follow
     **net**-points gaps (drops applied — the basis of the official positions; a gross-points
     knob is deferred). Pins override both modes (in points mode a pin fixes its own row).
   - `points_by_session[]` yields a **form signal** (recent-sessions average vs season average),
     shown as per-row ▲▼ chips; form never moves a price — the admin reorders with the rank
     arrows (a one-tap "apply suggested move" is deferred).
4. **Entity-type mode per series: Teams | Drivers.** Roster rules don't encode entity type
   (`SlotType` is class-scoped Main only), so the Prices screen gets an explicit mode toggle,
   defaulting to whichever entity type already has prices for the round. In Drivers mode the
   screen renders driver rows (same columns, same bulk save with `entityType: 'Driver'`). Driver
   prices are never derived from car prices — team series simply never price drivers.

## Consequences

- v1 ships with zero backend work and unblocks MX-5 (driver rows in the Prices screen are part of
  this change). The engine can never write a price the admin didn't review.
- Ranking/pin work is ephemeral; redoing it next round is acceptable at current scale. If it
  becomes a chore, persistence is a small season-scoped table (rank order, pins, per-championship
  entity mode + rounding step) — deliberately deferred.
- Matching quality depends on entry data freshness (car numbers per class, driver names from
  ADR-0011 imports); warnings make mismatches visible instead of silently mispricing.
- The Al Kamel points schema is an external contract; the parser must tolerate field drift the
  same way the entry-list importer does (warn, never guess).

## To revisit

- Persist rankings/pins + per-championship settings (entity mode, rounding step) server-side.
- Fantasy-results-derived form hints once a series has scored rounds (was the original plan;
  blocked at pricing time for unscored series).
- Tier bands (grouped spacing) if pins prove too fiddly; ownership-informed drift (post-lock
  pick % exists in round stats) as a later flavor.
