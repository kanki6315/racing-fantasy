/**
 * Wall-clock formatting for the moments a countdown refers to.
 *
 * A countdown answers "how long?" and never "when?" — a player deciding whether to finish a lineup
 * tonight or tomorrow morning needs the actual time. Both surfaces that show a lock (the Landing
 * hero band and the pick page's status pill) print the same string from here, because two hand-kept
 * copies of a date format drift and then disagree about the same deadline.
 */

/** "SAT · JUL 30 · 11:05 AM" — the absolute moment behind a countdown, in the viewer's timezone. */
export function fmtLockTime(iso: string) {
  const d = new Date(iso)
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' })
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${wd} · ${md} · ${t}`.toUpperCase()
}

/**
 * "Oct 11, 2026" — the calendar date alone, for artifacts that outlive the weekend.
 *
 * The share card needs this and the countdown formats above do not supply it: they answer "when is
 * the deadline?" and deliberately omit the year, which is the one component a shared image cannot do
 * without. Events recur annually, so a picture captioned "Petit Le Mans" with no year is unreadable
 * six months later — including to the person who made it.
 */
export function fmtRaceDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Sentence-case variant for prose and accessible labels: "Sat, Jul 30 at 11:05 AM". */
export function fmtLockTimeLong(iso: string) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} at ${t}`
}
