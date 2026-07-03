# ADR-0011: Per-round entry lists + parser JSON import

**Status:** Accepted (2026-07-03)

## Context

Entry lists were built by hand (admin bulk grids, seed scripts) against a season-scoped model:
`entry_driver` had no round dimension, so a car's displayed lineup was the season *union* of
everyone who ever shared it, and scoring resolved a driver MAIN pick to a car via first-link-wins
over the whole season — wrong after a mid-season car swap (common in MX-5 / Pilot Challenge).
Meanwhile the broadcast-prep parser now converts each series' pre-event entry-list PDF into a
stable JSON (one file per series per event: event block + entries with class, car, team, chassis,
and drivers with rating/order/markers/TBD), which is per-**event** truth, not per-season.

## Decision

1. **`entry_driver.round_id` (nullable)** — same pattern as `roster_rule.round_id`: NULL = a
   season-wide row (all pre-existing/manual data), set = that round's entry list. Readers (price
   board lineup, scoring's driver→car map) use a car's round rows when any exist, else its NULL
   rows. Unique key becomes `(car_entry_id, driver_id, round_id)` NULLS NOT DISTINCT.
2. **Entry-scoped driver metadata on `entry_driver`:** `rating` (enum Platinum/Gold/Silver/Bronze
   from the P/G/S/B letters — per season, and series adjust the FIA standard), `slot_order`
   (listed lineup order; legacy rows keep insertion-id order), `is_rookie`, `is_coach` (marker
   booleans; the parser emits exactly these two).
3. **Entry metadata on `car_entry`:** `car_model` (full string, not decomposed into a manufacturer
   — first-token splitting fails on "Aston Martin …"/"Mercedes-AMG …") and `bronze_cup`. Sponsor,
   tire, engine, fuel and driver hometowns are deliberately **not** stored.
4. **`POST /rounds/{roundId}/entry-list/import` (Admin)** accepts the parser JSON verbatim.
   The admin picks the target round (UI context); the file's event block is validated (series
   vs championship slug, year) into *warnings*, never guessed from. `?dryRun=true` returns the
   full result as a preview without writing; `?createMissingClasses=true` creates unknown classes
   (name = `class_code`, sort_order = `class_order`). Cars/drivers stay season-scoped upserts with
   the manual import's identity rules (car = season+class+number; driver = global name match, so
   cross-series drivers dedupe). The newest file wins for every field it carries; `driver.country`
   only fills a null. TBD seats are skipped (re-import adds the named driver later); unknown
   ratings/markers warn and import without the value; structural problems 422 with row indexes.

## Consequences

- Pick-board lineups and driver-pick scoring are event-accurate wherever an entry list was
  imported; a driver skipping a round was already handled by per-round pricing.
- Rows with NULL round keep the old union/first-wins behavior until a per-round import exists for
  that season — no backfill guessing.
- Re-import converges (idempotent); lineups are additive across rounds, so endurance third
  drivers survive sprint-file imports.
- Known limitation: exact-name driver matching can create near-duplicates ("LP" vs "L.P."); the
  dry-run preview lists every to-be-created driver for eyeballing before commit.
