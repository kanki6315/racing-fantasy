// Event lifecycle status (ADR-0008 amendment). One weekend moves through five stages; the display
// status is DERIVED, not stored — time drives the open→locked transition automatically, while two
// manual admin flags (`scored`, `finalized`) cover what time can't tell us. This is the single source
// of truth; screens should not re-implement the picksOpen-vs-quali logic inline.

export type EventStatus = 'WAITING' | 'OPEN' | 'IN_PROGRESS' | 'SCORED' | 'CLOSED'

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

/**
 * Precedence (top wins): finalized → scored → first round locked → picks open → waiting.
 * IN_PROGRESS is purely time-derived and ignores `picksOpen`, so an admin closing picks *after*
 * quali can neither hide the event nor revert the badge to "open".
 */
export function deriveEventStatus(e: StatusEvent, now: number = Date.now()): EventStatus {
  if (e.finalized) return 'CLOSED'
  if (e.scored) return 'SCORED'
  const fq = firstQuali(e)
  if (fq != null && now >= fq) return 'IN_PROGRESS'
  if (e.picksOpen) return 'OPEN'
  return 'WAITING'
}

/** Statuses the player Dashboard surfaces — Waiting (not released) and Closed (finalized) drop off. */
export const SHOWN_ON_DASHBOARD: readonly EventStatus[] = ['OPEN', 'IN_PROGRESS', 'SCORED']

export function isShownOnDashboard(status: EventStatus): boolean {
  return SHOWN_ON_DASHBOARD.includes(status)
}

/** Label + Tailwind color classes (border/bg/text) per status; layout/sizing is the caller's. */
export const EVENT_STATUS_META: Record<EventStatus, { label: string; className: string }> = {
  WAITING: { label: 'Waiting to Open', className: 'border-line-2 bg-surface-2 text-muted-2' },
  OPEN: { label: 'Picks Open', className: 'border-success/40 bg-success/10 text-success' },
  IN_PROGRESS: { label: 'In Progress', className: 'border-warn/40 bg-warn/10 text-warn' },
  SCORED: { label: 'Scored', className: 'border-lmp2/40 bg-lmp2/10 text-lmp2-2' },
  CLOSED: { label: 'Closed', className: 'border-line-2 bg-surface-2 text-muted' },
}
