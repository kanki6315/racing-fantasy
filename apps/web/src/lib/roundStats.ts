import type { RoundStats } from '../api/queries'

export type EntityStat = RoundStats['entities'][number]

/** A picked entity keyed the way both the stats payload and a player's picks agree on. */
export function entityKey(e: { entityType: string; entityId: number }): string {
  return `${e.entityType}-${e.entityId}`
}

/**
 * One row of the stats board: the API's figures plus the two things the board derives — how the
 * entity scored against its class, and whether the signed-in player owned it.
 */
export type BoardRow = {
  e: EntityStat
  /** Points minus the median of picked entities in the same class. `null` until the round is scored. */
  swing: number | null
  mine: boolean
}

export type SortKey = 'own' | 'pts' | 'swing'
export type SortDir = 'asc' | 'desc'
export type Sort = { key: SortKey; dir: SortDir }

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * SWING — points above or below the median *picked* entity in the same class.
 *
 * The baseline is the class median rather than the class mean, and rather than a field-wide average,
 * for two reasons. Roster rules put one pick in each class, so "did this beat a typical pick in its
 * class" is the question a player actually has; and within-class normalisation is what stops the old
 * points ÷ price ranking from degenerating into a list of the cheapest class (measured: 10 of 10 rows
 * in Round 1, 9 of 10 in Round 2, all GTD).
 *
 * The median is over picked entities only, because that is all the stats payload carries — the board
 * says so in as many words rather than implying a field-wide baseline it can't compute.
 */
export function buildRows(entities: EntityStat[], mine: ReadonlySet<string>): BoardRow[] {
  const medians = new Map<number, number | null>()
  for (const e of entities) {
    if (medians.has(e.classId)) continue
    const pts = entities.filter((x) => x.classId === e.classId && x.points != null).map((x) => x.points!)
    medians.set(e.classId, median(pts))
  }
  return entities.map((e) => {
    const base = medians.get(e.classId) ?? null
    return {
      e,
      swing: e.points != null && base != null ? e.points - base : null,
      mine: mine.has(entityKey(e)),
    }
  })
}

function valueFor(r: BoardRow, key: SortKey): number | null {
  if (key === 'own') return r.e.pickPct
  if (key === 'pts') return r.e.points
  return r.swing
}

/**
 * Sort by one column. Rows with no value for that column (an entity that didn't score, or any row
 * before the round is scored) sink to the bottom in *both* directions — an ascending sort that opens
 * on a wall of em-dashes is technically correct and useless.
 */
export function sortRows(rows: BoardRow[], { key, dir }: Sort): BoardRow[] {
  const sign = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const av = valueFor(a, key)
    const bv = valueFor(b, key)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (av !== bv) return (av - bv) * sign
    // Stable tiebreak so equal values don't reshuffle between renders.
    return a.e.displayName?.localeCompare(b.e.displayName ?? '') ?? 0
  })
}

/** `+106` / `-25` / `—`. The sign is the point, so it is always shown. */
export function fmtSwing(v: number | null): string {
  if (v == null) return '—'
  const r = Math.round(v)
  return r > 0 ? `+${r}` : `${r}`
}
