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

/** A points contribution, signed — a delta reads as a delta. */
export const fmtPts = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1))

/** A points total, unsigned. Totals are magnitudes, not movements. */
export const fmtTotal = (n: number) => n.toFixed(1)

/** Salary in the pick page's exact dialect (`$12.8M`) — a budget must not read two ways. */
export const fmtMoney = (n: number) => `$${n.toFixed(1)}M`

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
