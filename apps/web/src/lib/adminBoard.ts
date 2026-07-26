import type { CarEntryDto, ClassDto, RoundDto, Season } from '../api/adminQueries'

/**
 * The cross-championship board: what an operator running six series needs before they need
 * anything about one round.
 *
 * The console has always answered "how is this round", while the question that actually starts an
 * operator's week is "which of my six needs me". Answering it used to mean six trips through the
 * topbar. Everything here is a pure function over data the console already fetches, so the band and
 * the round detail underneath it are computed from the same facts and cannot contradict each other.
 */

/**
 * The round whose qualifying is soonest in the future, else the last round.
 *
 * Lifted out of AdminContext because the band needs it once per championship and the topbar needs
 * it for the selected one. Two copies of "which round is current" is precisely the drift that had
 * the Overview and the Prices board disagreeing about how many cars needed pricing.
 */
export function pickCurrentRound(rounds: RoundDto[], now: number): RoundDto | undefined {
  if (rounds.length === 0) return undefined
  const upcoming = rounds
    .filter((r) => Date.parse(r.qualiStart) >= now)
    .sort((a, b) => Date.parse(a.qualiStart) - Date.parse(b.qualiStart))
  return upcoming[0] ?? [...rounds].sort((a, b) => b.sequence - a.sequence)[0]
}

/** Which setup step is holding a championship up, as far as can be known without its prices. */
export type BoardBlocker =
  | { kind: 'no-season' }
  | { kind: 'no-round' }
  | { kind: 'catalog' }
  | { kind: 'entries' }
  /** Everything upstream is satisfied; whether it's Prices or Sessions depends on a per-round fetch. */
  | { kind: 'needs-prices'; roundId: number; carCount: number }
  | { kind: 'sessions' }
  | { kind: 'ready' }

export type BoardRow = {
  championshipId: number
  championshipName: string
  seasonId?: number
  round?: RoundDto
  blocker: BoardBlocker
  /** ms until this round's lock; negative once it has passed. `null` when there's no round. */
  msToLock: number | null
}

/**
 * One row per championship, resolved as far as the shared unfiltered lists allow.
 *
 * Deliberately stops short of Prices: that is the only figure with no unfiltered endpoint, so
 * resolving it here would mean one request per championship whether or not the row needed it. A row
 * blocked at Catalog or Entries never asks for prices at all — the `needs-prices` blocker is the
 * hand-off point where a row takes on that cost, and only then.
 */
export function buildBoardRows(input: {
  championships: { id: number; name: string }[]
  seasons: Season[]
  rounds: RoundDto[]
  classes: ClassDto[]
  cars: CarEntryDto[]
  now: number
}): BoardRow[] {
  const { championships, seasons, rounds, classes, cars, now } = input

  return championships.map((c) => {
    // Newest season, the same rule the topbar heals to.
    const season = [...seasons.filter((s) => s.championshipId === c.id)].sort((a, b) => b.year - a.year)[0]
    const base = { championshipId: c.id, championshipName: c.name, seasonId: season?.id }
    if (!season) return { ...base, blocker: { kind: 'no-season' }, msToLock: null }

    const round = pickCurrentRound(
      rounds.filter((r) => r.seasonId === season.id),
      now,
    )
    if (!round) return { ...base, blocker: { kind: 'no-round' }, msToLock: null }

    const msToLock = Date.parse(round.qualiStart) - now
    const row = { ...base, round, msToLock }

    const classCount = classes.filter((k) => k.championshipId === c.id).length
    if (classCount === 0) return { ...row, blocker: { kind: 'catalog' } }

    const carCount = cars.filter((x) => x.seasonId === season.id).length
    if (carCount === 0) return { ...row, blocker: { kind: 'entries' } }

    return { ...row, blocker: { kind: 'needs-prices', roundId: round.id, carCount } }
  })
}

/**
 * Sessions are checked after prices, matching the pipeline's order, so this is the tail of the
 * resolution that only a row with its prices in hand can finish.
 */
export function resolveAfterPrices(
  row: BoardRow,
  pricedCarCount: number,
  totalCars: number,
  sessionCount: number,
): BoardBlocker {
  // Only reachable for a row already carrying a `needs-prices` blocker, which is only produced once
  // a round exists — so the id is read off that blocker rather than asserting `row.round` is set.
  const roundId = row.blocker.kind === 'needs-prices' ? row.blocker.roundId : (row.round?.id ?? 0)
  if (pricedCarCount < totalCars) return { kind: 'needs-prices', roundId, carCount: totalCars }
  if (sessionCount === 0) return { kind: 'sessions' }
  return { kind: 'ready' }
}

/**
 * Urgency order: the row that needs work soonest goes first, and anything ready sinks. A board sorted
 * by championship id would put the series that needs nothing above the one locking tonight, which is
 * the opposite of the question being asked.
 */
export function sortByUrgency(rows: BoardRow[]): BoardRow[] {
  const rank = (r: BoardRow) => {
    if (r.blocker.kind === 'ready') return 3
    if (r.blocker.kind === 'no-season' || r.blocker.kind === 'no-round') return 2
    return r.msToLock != null && r.msToLock < 0 ? 1 : 0 // outstanding-and-locked sinks below outstanding-and-live
  }
  return [...rows].sort((a, b) => {
    const d = rank(a) - rank(b)
    if (d !== 0) return d
    return (a.msToLock ?? Infinity) - (b.msToLock ?? Infinity)
  })
}
