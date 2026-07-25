import type { ElementType } from 'react'
import { Link } from 'react-router-dom'
import type { LeaderboardEntry } from '../api/queries'

/** Podium emphasis: the leader carries the one red, then the ink ramp dims down the order. */
function rankColor(rank: number): string {
  if (rank === 1) return 'text-brand-2'
  if (rank === 2) return 'text-ink'
  if (rank === 3) return 'text-ink-2'
  return 'text-ink-2'
}

/**
 * Round-over-round rank change on cumulative boards. `null` (single-round board, or a team's first
 * scored round) renders nothing; `0` holds; ±n climbs/drops. Positive = moved up the table.
 * Exported so the position bug can speak the exact same delta vocabulary as the row it points at.
 */
export function Movement({ value }: { value?: number | null }) {
  if (value == null) return null
  const label = value > 0 ? `up ${value}` : value < 0 ? `down ${-value}` : 'no change'
  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted'
  return (
    <span aria-label={`Moved ${label} since last round`} className={`font-mono text-[10px] leading-none ${tone}`}>
      {value > 0 ? `▲${value}` : value < 0 ? `▼${-value}` : '—'}
    </span>
  )
}

/**
 * The "you" row treatment, shared by the desktop grid and the mobile card list.
 *
 * The 7% wash this replaces measured 1.02:1 against the surface — invisible in practice, which left
 * the row you'd just scrolled 40 rows to find looking like every other row. This pairs the two
 * tinted-wash forms the One Red Rule explicitly sanctions (a `brand/14` fill and a full `brand/40`
 * hairline, drawn as an inset ring so the row doesn't shift by a pixel) with the solid slash and YOU
 * chip already on the row. Still no solid-red *fill*, so the page's red budget is untouched.
 *
 * `focus:` rather than `:focus-visible:` is deliberate — {@link YourPosition} moves focus here
 * programmatically after a mouse click, which never matches `:focus-visible`, and the arrival has to
 * be visible. It doubles as the reduced-motion alternative to the flash.
 */
const MINE_ROW =
  'bg-brand/[0.14] shadow-[inset_0_0_0_1px_rgba(225,6,0,0.4)] focus:outline-2 focus:outline-offset-[-2px] focus:outline-brand-3'

/** Marks the viewer's row for the position bug to find, scroll to, and focus. */
const MINE_PROPS = { 'data-my-row': '', tabIndex: -1 } as const

/**
 * Shared standings table for every leaderboard surface (season, round, league, global).
 * `myRegistrationId` highlights the viewer's row; `showName` reveals the real name column
 * (members-only private leagues — the API only returns `name` when allowed).
 */
export function Leaderboard({
  entries,
  myRegistrationId,
  showName = false,
  emptyMessage = 'No standings yet — rows appear once a round is scored.',
  rowHref,
}: {
  entries: LeaderboardEntry[]
  myRegistrationId?: number
  showName?: boolean
  emptyMessage?: string
  /** When set, each row links to this URL — used to drill into a player's picks for a scored round. */
  rowHref?: (entry: LeaderboardEntry) => string
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[4px] border border-dashed border-line-2 px-5 py-12 text-center font-sans text-[13px] text-muted">
        {emptyMessage}
      </div>
    )
  }

  const cols = showName
    ? 'grid-cols-[64px_1fr_minmax(0,1fr)_110px_90px]'
    : 'grid-cols-[64px_1fr_110px_90px]'

  // Integer points render without the ".0" — but if ANY row is fractional, every row keeps one
  // decimal so the column still aligns to the digit (The Tabular-Numeral Rule).
  const showDecimals = entries.some((e) => !Number.isInteger(e.points))
  const fmtPoints = (p: number) => (showDecimals ? p.toFixed(1) : p.toLocaleString())

  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
      {/* sm+ : the full grid table */}
      <div className="hidden sm:block">
        <div className={`grid ${cols} items-center border-b border-line bg-surface-3 px-[18px] py-[10px] font-display text-[11px] tracking-[0.1em] uppercase text-muted`}>
          <span>#</span>
          <span>Team</span>
          {showName && <span>Player</span>}
          <span className="text-right">Points</span>
          <span className="text-right">Rounds</span>
        </div>
        {entries.map((e) => {
          const mine = myRegistrationId != null && e.registrationId === myRegistrationId
          const href = rowHref?.(e)
          const Row: ElementType = href ? Link : 'div'
          return (
            <Row
              key={e.registrationId}
              {...(href ? { to: href } : {})}
              {...(mine ? MINE_PROPS : {})}
              className={`grid ${cols} items-center border-b border-surface-2 px-[18px] py-[13px] ${
                mine ? MINE_ROW : ''
              } ${href ? `transition-colors ${mine ? 'hover:bg-brand/[0.2]' : 'hover:bg-surface-2'}` : ''}`}
            >
              <span className="flex items-baseline gap-1.5">
                <span className={`font-mono text-[16px] font-bold ${rankColor(e.rank)}`}>{e.rank}</span>
                <Movement value={e.movement} />
              </span>
              <span className="flex items-center gap-2 truncate font-display text-[15px] font-bold uppercase tracking-[0.02em] text-ink">
                <span className={`h-[15px] w-[4px] flex-none [transform:skewX(-14deg)] ${mine ? 'bg-brand' : 'bg-line-3'}`} />
                <span className="truncate">{e.teamName}</span>
                {mine && <span className="flex-none rounded-[2px] bg-brand px-[6px] py-[1px] font-mono text-[10px] tracking-[0.08em] text-ink">YOU</span>}
              </span>
              {showName && <span className="truncate font-sans text-[12px] text-muted">{e.name ?? '—'}</span>}
              <span className="text-right font-mono text-[15px] font-semibold text-ink">{fmtPoints(e.points)}</span>
              <span className="text-right font-mono text-[12px] text-muted">{e.roundsScored}</span>
            </Row>
          )
        })}
      </div>

      {/* < sm : each entry reflows into a card (rank · team + meta · points) */}
      <div className="sm:hidden">
        {entries.map((e) => {
          const mine = myRegistrationId != null && e.registrationId === myRegistrationId
          const href = rowHref?.(e)
          const Row: ElementType = href ? Link : 'div'
          return (
            <Row
              key={e.registrationId}
              {...(href ? { to: href } : {})}
              {...(mine ? MINE_PROPS : {})}
              className={`flex items-center gap-3 border-b border-surface-2 px-4 py-3 ${
                mine ? MINE_ROW : ''
              } ${href ? `transition-colors ${mine ? 'active:bg-brand/[0.2]' : 'active:bg-surface-2'}` : ''}`}
            >
              <span className="flex w-7 shrink-0 flex-col items-center gap-0.5">
                <span className={`font-mono text-[18px] font-bold leading-none ${rankColor(e.rank)}`}>{e.rank}</span>
                <Movement value={e.movement} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`h-[14px] w-[4px] flex-none [transform:skewX(-14deg)] ${mine ? 'bg-brand' : 'bg-line-3'}`} />
                  <span className="truncate font-display text-[15px] font-bold uppercase tracking-[0.02em] text-ink">{e.teamName}</span>
                  {mine && <span className="flex-none rounded-[2px] bg-brand px-[6px] py-[1px] font-mono text-[10px] tracking-[0.08em] text-ink">YOU</span>}
                </div>
                <div className="mt-[3px] flex items-center gap-1.5 truncate font-mono text-[11px] text-muted">
                  <span>{e.roundsScored} {e.roundsScored === 1 ? 'round' : 'rounds'}</span>
                  {showName && e.name && <span className="truncate text-muted">· {e.name}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[17px] font-bold leading-none text-ink">{fmtPoints(e.points)}</div>
                <div className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted">pts</div>
              </div>
            </Row>
          )
        })}
      </div>
    </div>
  )
}
