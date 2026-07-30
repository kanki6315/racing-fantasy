/**
 * How a scored pick reads, shared by every surface that shows one (the standings drill-in and the
 * dashboard's scored weekend). These were duplicated inline; two screens printing the same score in
 * two dialects is exactly the drift DESIGN.md's lifecycle-pill rule warns about.
 */

/** Per-source short label for a pick's points breakdown. Multi-race weekends number the races. */
export function sourceLabel(s: { source: string; raceNumber?: number | null }, raceCount: number): string {
  switch (s.source) {
    case 'QualifyingPosition':
      return 'Q'
    case 'RacePosition':
      return raceCount > 1 ? `R${s.raceNumber ?? 1}` : 'R'
    case 'RaceFastestLap':
      return 'FL'
    case 'Bonus':
      return 'B'
    default:
      return s.source
  }
}

/**
 * The same label, spelled out, for the share card.
 *
 * `Q` and `R` are fine in the app: the reader is a player, the column is narrow, and they learn the
 * shorthand in one round. A share card is the opposite case on both counts — its whole audience is
 * people who have never opened the app (that is what sharing *is*), and its rows have a wide empty
 * middle column. To that reader `Q +48.0  R +364.0` is unreadable, so the card pays the width and
 * says the words. Kept beside `sourceLabel` so the two vocabularies can't drift apart.
 */
export function sourceLabelLong(s: { source: string; raceNumber?: number | null }, raceCount: number): string {
  switch (s.source) {
    case 'QualifyingPosition':
      return 'QUALI'
    case 'RacePosition':
      return raceCount > 1 ? `RACE ${s.raceNumber ?? 1}` : 'RACE'
    case 'RaceFastestLap':
      return 'FASTEST LAP'
    case 'Bonus':
      return 'BONUS'
    default:
      return s.source
  }
}

/** A points contribution, signed — a delta reads as a delta. */
export const fmtPts = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1))

/** A points total, unsigned. Totals are magnitudes, not movements. */
export const fmtTotal = (n: number) => n.toFixed(1)

/**
 * The standings board's number rule, as a formatter over a known set of values.
 *
 * Integer points render without a trailing `.0` and take a thousands separator; but if ANY value in
 * the set is fractional, every value keeps one decimal so the column still aligns to the digit (The
 * Tabular-Numeral Rule). The decision is per *set*, not per value — that is the whole point, and it
 * is why this takes the values up front rather than formatting one number at a time.
 *
 * This lived inline in `Leaderboard.tsx`. The share card needed the same rule, and the fix for "two
 * surfaces formatting the same figure two ways" is not a third copy — the board and the card now
 * call this, so the convention has exactly one definition.
 */
export function makePointsFormat(values: number[]) {
  const decimals = values.some((v) => !Number.isInteger(v))
  const fmt = (n: number) => (decimals ? n.toFixed(1) : n.toLocaleString())
  return {
    decimals,
    /** A magnitude: `1,523` or `1523.5`. */
    fmt,
    /** A signed contribution: `+385`, `-12`, `+35.5`. Negatives carry their own sign. */
    delta: (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n)),
  }
}

/**
 * Salary in the pick page's exact dialect (`$12.8M`, `$8.75M`) — a budget must not read two ways.
 *
 * One decimal only when the value actually sits on a $0.1M step. The price board deals in quarter
 * steps (the suggestion engine emits `8.75`, `5.25`), and a flat `toFixed(1)` rounded each row
 * independently — a lineup the server verified at exactly the $35.0M cap displayed rows summing to
 * $35.1M. Rounding through cents so float noise can't misclassify a value near a step boundary.
 */
export const fmtMoney = (n: number) => {
  const cents = Math.round(n * 100)
  return `$${(cents / 100).toFixed(cents % 10 === 0 ? 1 : 2)}M`
}

/**
 * A season-long total, as the standings board sets it: thousands separated, and a decimal only when
 * the value actually has one. The board decides per column so its digits align; a figure standing on
 * its own outside a column decides per value.
 */
export const fmtSeasonPoints = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1))

/**
 * Has scoring actually run for this round? A freshly locked round returns picks with zero points
 * and no source rows, which must read as "not scored yet" rather than as a genuine zero.
 */
export function hasScored(picks: { total: number; main: { scores: unknown[] }[] }): boolean {
  return picks.total !== 0 || picks.main.some((p) => p.scores.length > 0)
}
