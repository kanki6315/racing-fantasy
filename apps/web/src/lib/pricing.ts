import type { CarEntryDto, EntryDriverDto } from '../api/adminQueries'

/**
 * The rules that decide *what a round is supposed to price*, in one place.
 *
 * Two screens need this and they must agree: the Prices board builds its rows from it, and the
 * admin Overview reports "how much of it is done". They used to disagree — Overview compared a
 * count of cars against a count of every priced entity, so a driver-priced round (MX-5) read
 * "all priced" while every car in it was unpriced. A count is only true if it counts the same
 * universe the board does.
 */

/** Which entity type a series prices (ADR-0012): team series price cars, driver series price drivers. */
export type PriceMode = 'Car' | 'Driver'

/**
 * The mode a round's existing prices imply: driver prices with no car prices ⇒ a driver-based
 * series. Same rule the player Pick page uses to read a board. An unpriced round has nothing to
 * infer from and falls back to 'Car', which is why callers must treat a zero-priced round as
 * "not started" rather than "0 of N drivers".
 */
export function inferPriceMode(prices: { entityType: string }[]): PriceMode {
  return prices.some((p) => p.entityType === 'Driver') && !prices.some((p) => p.entityType === 'Car')
    ? 'Driver'
    : 'Car'
}

/**
 * The round's driver lineup, car by car: which drivers are priceable this weekend.
 *
 * Round-scoped lineup rows win over season-wide ones (ADR-0011), so a mid-season swap prices the
 * driver who actually turned up. A driver sharing two cars appears once, under the first car that
 * lists them.
 */
export function roundLineup(
  cars: CarEntryDto[],
  entryDrivers: EntryDriverDto[],
  roundId: number | undefined,
): { car: CarEntryDto; entry: EntryDriverDto }[] {
  const carById = new Map(cars.map((c) => [c.id, c]))
  const byCar = new Map<number, EntryDriverDto[]>()
  for (const ed of entryDrivers) {
    if (!carById.has(ed.carEntryId)) continue
    const list = byCar.get(ed.carEntryId)
    if (list) list.push(ed)
    else byCar.set(ed.carEntryId, [ed])
  }

  const out: { car: CarEntryDto; entry: EntryDriverDto }[] = []
  const seen = new Set<number>()
  for (const car of cars) {
    const list = byCar.get(car.id) ?? []
    const roundRows = list.filter((ed) => ed.roundId === roundId)
    const chosen = (roundRows.length ? roundRows : list.filter((ed) => ed.roundId == null)).sort(
      (a, b) => (a.slotOrder ?? a.id) - (b.slotOrder ?? b.id),
    )
    for (const ed of chosen) {
      if (seen.has(ed.driverId)) continue
      seen.add(ed.driverId)
      out.push({ car, entry: ed })
    }
  }
  return out
}

/**
 * How far along a round's pricing is, counted against the universe that round actually prices.
 * `total` is 0 when there is nothing to price yet (no entry list imported), which reads as
 * "blocked upstream", not "complete".
 */
export function pricingProgress(
  cars: CarEntryDto[],
  entryDrivers: EntryDriverDto[],
  prices: { entityType: string; entityId: number }[],
  roundId: number | undefined,
): { mode: PriceMode; priced: number; total: number; unpricedIds: number[] } {
  const mode = inferPriceMode(prices)
  const pricedIds = new Set(prices.filter((p) => p.entityType === mode).map((p) => p.entityId))

  const universe =
    mode === 'Car' ? cars.map((c) => c.id) : roundLineup(cars, entryDrivers, roundId).map((r) => r.entry.driverId)

  // The ids, not just the count: a screen that can say "1 car still needs a price" and not *which*
  // car sends the operator to hunt a 55-row board for something this already knows.
  const unpricedIds = universe.filter((id) => !pricedIds.has(id))
  return { mode, priced: universe.length - unpricedIds.length, total: universe.length, unpricedIds }
}
