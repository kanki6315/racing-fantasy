// Event lifecycle status (ADR-0008 amendment). One weekend moves through six stages; the display
// status is DERIVED, not stored — time drives the open→locked transition automatically, while two
// manual admin flags (`scored`, `finalized`) cover what time can't tell us. IN_PROGRESS additionally
// time-decays to AWAITING (results pending) so a forgotten `scored` flag can't leave a weekend
// "in progress" forever. This is the single source of truth; screens should not re-implement the
// picksOpen-vs-quali logic inline.

export type EventStatus = 'WAITING' | 'OPEN' | 'IN_PROGRESS' | 'AWAITING' | 'SCORED' | 'CLOSED'

/** How long after the LAST quali a weekend may read "In Progress" before decaying to AWAITING.
 *  Races run within a couple of days of their quali; 72h comfortably covers every weekend format. */
const AWAITING_GRACE_MS = 72 * 60 * 60 * 1000

/** Minimal event shape the derivation needs — structurally satisfied by EventDto. */
export type StatusEvent = {
  picksOpen: boolean
  scored: boolean
  finalized: boolean
  rounds: { qualiStart: string }[]
}

/** Earliest quali across the weekend's rounds (the FIRST round to lock), in epoch ms, or null. */
function firstQuali(e: StatusEvent): number | null {
  let min: number | null = null
  for (const r of e.rounds) {
    const t = Date.parse(r.qualiStart)
    if (!Number.isNaN(t) && (min == null || t < min)) min = t
  }
  return min
}

/** Latest quali across the weekend's rounds (the LAST round to lock), in epoch ms, or null. */
function lastQuali(e: StatusEvent): number | null {
  let max: number | null = null
  for (const r of e.rounds) {
    const t = Date.parse(r.qualiStart)
    if (!Number.isNaN(t) && (max == null || t > max)) max = t
  }
  return max
}

/**
 * Precedence (top wins): finalized → scored → first round locked (decaying to AWAITING once the
 * last quali is AWAITING_GRACE_MS in the past) → picks open → waiting.
 * IN_PROGRESS is purely time-derived and ignores `picksOpen`, so an admin closing picks *after*
 * quali can neither hide the event nor revert the badge to "open". The AWAITING decay exists so a
 * stale manual `scored` flag can't leave a long-finished weekend reading "In Progress".
 */
export function deriveEventStatus(e: StatusEvent, now: number = Date.now()): EventStatus {
  if (e.finalized) return 'CLOSED'
  if (e.scored) return 'SCORED'
  const fq = firstQuali(e)
  if (fq != null && now >= fq) {
    const lq = lastQuali(e)
    return lq != null && now >= lq + AWAITING_GRACE_MS ? 'AWAITING' : 'IN_PROGRESS'
  }
  if (e.picksOpen) return 'OPEN'
  return 'WAITING'
}

/**
 * The same derivation for a surface that holds ONE round rather than a whole weekend — the standings
 * drill-in, and the share card rendered from it. A round reached through that page is already past
 * its lock (the API gates the endpoint on it), so `picksOpen` is moot and only the quali time and the
 * scored flag carry information. Routed through `deriveEventStatus` rather than reimplemented, so a
 * round and the weekend containing it can never name the same moment differently.
 */
export function deriveRoundStatus(
  round: { qualiStart: string },
  scored: boolean,
  now: number = Date.now(),
): EventStatus {
  return deriveEventStatus({ picksOpen: true, scored, finalized: false, rounds: [round] }, now)
}

/** Statuses the player Dashboard surfaces — Waiting (not released) and Closed (finalized) drop off. */
export const SHOWN_ON_DASHBOARD: readonly EventStatus[] = ['OPEN', 'IN_PROGRESS', 'AWAITING', 'SCORED']

export function isShownOnDashboard(status: EventStatus): boolean {
  return SHOWN_ON_DASHBOARD.includes(status)
}

/**
 * Label + Tailwind color classes (border/bg/text) per status; layout/sizing is the caller's.
 *
 * `dotClassName` is the fill for the leading dot pills carry, and `hex` the same colour as a raw
 * value for surfaces that can't use a class — the share card draws to a canvas, where Tailwind does
 * not reach. Both are derived from the same row as `className` so a status cannot wear one colour in
 * the DOM and another in an exported image.
 */
export const EVENT_STATUS_META: Record<
  EventStatus,
  { label: string; className: string; dotClassName: string; hex: string }
> = {
  WAITING: {
    label: 'Waiting to Open',
    className: 'border-line-2 bg-surface-2 text-muted',
    dotClassName: 'bg-muted-2',
    hex: '#8a8f98',
  },
  OPEN: {
    label: 'Picks Open',
    className: 'border-success/40 bg-success/10 text-success',
    dotClassName: 'bg-success',
    hex: '#2dd4bf',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'border-warn/40 bg-warn/10 text-warn',
    dotClassName: 'bg-warn',
    hex: '#ff9e2c',
  },
  AWAITING: {
    label: 'Awaiting Results',
    className: 'border-line-2 bg-surface-2 text-ink-2',
    dotClassName: 'bg-ink-2',
    hex: '#c8ccd2',
  },
  SCORED: {
    label: 'Scored',
    className: 'border-line-3 bg-ink/10 text-ink',
    dotClassName: 'bg-ink',
    hex: '#ffffff',
  },
  CLOSED: {
    label: 'Final',
    className: 'border-line-2 bg-surface-2 text-muted',
    dotClassName: 'bg-muted',
    hex: '#8a8f98',
  },
}
