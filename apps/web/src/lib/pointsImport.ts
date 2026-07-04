/**
 * Al Kamel "POINTS DATA" JSON parsing for the price suggestion engine (ADR-0012).
 *
 * Two shapes share one schema ({ championship: { name, sessions[] }, classification: [...] }):
 * team standings come one file per class with `key` = car number + a `team` name; driver
 * standings are one file for the field with `key` = the driver's full name. Rows carry official
 * `position`, `total_points`, net variants (drops applied), and a full per-session breakdown —
 * which is what the form signal is computed from. Parsed entirely client-side (the results host
 * serves no CORS headers, so the admin downloads the file and drops it in).
 */

export type PointsRow = {
  key: string // car number (teams) or driver full name (drivers)
  team: string | null
  position: number
  totalPoints: number
  totalNetPoints: number
  /** ▲ hot / ▼ cold when recent sessions clearly beat / trail the season per-session average. */
  form: 'hot' | 'cold' | null
}

export type ParsedPointsFile = {
  kind: 'Teams' | 'Drivers'
  championshipName: string
  year: string | null
  rows: PointsRow[]
}

/** Sessions considered "recent" for the form signal. */
const FORM_WINDOW = 3
/** Form needs at least this many run sessions to mean anything. */
const FORM_MIN_SESSIONS = 4

export function parsePointsFile(text: string): ParsedPointsFile {
  let doc: unknown
  try {
    doc = JSON.parse(text.replace(/^﻿/, '')) // Al Kamel files ship with a BOM
  } catch {
    throw new Error('not valid JSON')
  }
  const root = doc as { championship?: { name?: string; year?: string }; classification?: unknown[] }
  if (!root?.championship || !Array.isArray(root.classification))
    throw new Error('not an Al Kamel points file (missing championship/classification)')

  const cls = root.classification as Array<{
    key?: unknown
    team?: unknown
    position?: unknown
    total_points?: unknown
    total_net_points?: unknown
    points_by_session?: Array<{ total_points?: unknown }>
  }>
  if (cls.length === 0) throw new Error('empty classification')

  // Sessions that have actually run = any entrant scored there. Trailing zeros for one entrant
  // are DNFs, not future rounds — so "run" is decided across the whole field.
  const sessionCount = Math.max(...cls.map((r) => r.points_by_session?.length ?? 0))
  const runSessions: number[] = []
  for (let i = 0; i < sessionCount; i++)
    if (cls.some((r) => Number(r.points_by_session?.[i]?.total_points ?? 0) > 0)) runSessions.push(i)

  const rows: PointsRow[] = cls.map((r) => {
    const bySession = (i: number) => Number(r.points_by_session?.[i]?.total_points ?? 0)
    let form: PointsRow['form'] = null
    if (runSessions.length >= FORM_MIN_SESSIONS) {
      const recent = runSessions.slice(-FORM_WINDOW)
      const recentAvg = recent.reduce((a, i) => a + bySession(i), 0) / recent.length
      const seasonAvg = runSessions.reduce((a, i) => a + bySession(i), 0) / runSessions.length
      if (seasonAvg > 0) {
        if (recentAvg >= seasonAvg * 1.3) form = 'hot'
        else if (recentAvg <= seasonAvg * 0.6) form = 'cold'
      }
    }
    return {
      key: String(r.key ?? ''),
      team: r.team != null ? String(r.team) : null,
      position: Number(r.position ?? 0),
      totalPoints: Number(r.total_points ?? 0),
      totalNetPoints: Number(r.total_net_points ?? r.total_points ?? 0),
      form,
    }
  })

  // Teams files carry a team name per row; drivers files don't (key IS the name).
  const kind: ParsedPointsFile['kind'] = cls.some((r) => r.team != null) ? 'Teams' : 'Drivers'
  return {
    kind,
    championshipName: String(root.championship.name ?? ''),
    year: root.championship.year != null ? String(root.championship.year) : null,
    rows,
  }
}

/**
 * Diacritic/punctuation-insensitive name key: "José Peréz-Smith " ≡ "jose perez smith".
 * Parenthesized markers are dropped first — points files suffix rookies as "Name(R)".
 */
export function normName(s: string): string {
  return s
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

/** Car-number key: strips leading zeros so the entry list's "04" matches the points file's "4". */
export function normNumber(s: string): string {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? String(n) : s.trim()
}
