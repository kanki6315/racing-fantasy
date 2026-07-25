import type { LeaderboardEntry } from '../api/queries'

/**
 * The board's column tracks, in one place.
 *
 * The table and the position bug ride the same grid — that alignment is the whole reason the bug
 * reads as your row lifted out rather than as a separate widget — so a width changed in one and not
 * the other silently breaks it. Spelled out as whole literal class strings rather than composed at
 * runtime because Tailwind scans source text: a template-built `grid-cols-[...64px_${n}]` generates
 * no CSS at all and fails as a silent no-op.
 *
 * The last track is Rounds (90px) or the row's destination label (108px — "VIEW PICKS →" measures
 * 84px, and at 90px it left only 6px of air between itself and the points value, so the two read as
 * one clump).
 */
export const BOARD_COLS = {
  plain: 'grid-cols-[64px_1fr_110px_90px]',
  plainLinked: 'grid-cols-[64px_1fr_110px_108px]',
  named: 'grid-cols-[64px_1fr_minmax(0,1fr)_110px_90px]',
  namedLinked: 'grid-cols-[64px_1fr_minmax(0,1fr)_110px_108px]',
} as const

/** The same tracks, `sm:`-prefixed — the bug is auto-columned on the card layout below that. */
export const BOARD_COLS_SM = {
  plain: 'sm:grid-cols-[64px_1fr_110px_90px]',
  plainLinked: 'sm:grid-cols-[64px_1fr_110px_108px]',
  named: 'sm:grid-cols-[64px_1fr_minmax(0,1fr)_110px_90px]',
  namedLinked: 'sm:grid-cols-[64px_1fr_minmax(0,1fr)_110px_108px]',
} as const

export function boardColsKey(showName: boolean, linked: boolean): keyof typeof BOARD_COLS {
  if (showName) return linked ? 'namedLinked' : 'named'
  return linked ? 'plainLinked' : 'plain'
}

/**
 * The ranks that more than one team shares.
 *
 * Ties arrive from the API as a bare repeat — "10, 10, 12" — which reads as a rendering bug rather
 * than as a dead heat. Every standings convention marks them; this one uses the `T10` form.
 *
 * Lives in `lib/` rather than beside the table because both the board and the position bug need it,
 * and a non-component export sitting in a component file breaks Fast Refresh.
 */
export function tiedRanks(entries: LeaderboardEntry[]): Set<number> {
  const seen = new Set<number>()
  const tied = new Set<number>()
  for (const e of entries) {
    if (seen.has(e.rank)) tied.add(e.rank)
    seen.add(e.rank)
  }
  return tied
}
