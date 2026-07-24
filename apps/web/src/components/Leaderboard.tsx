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
 */
function Movement({ value }: { value?: number | null }) {
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
              className={`grid ${cols} items-center border-b border-surface-2 px-[18px] py-[13px] ${
                mine ? 'bg-brand/[0.07]' : ''
              } ${href ? 'transition-colors hover:bg-surface-2' : ''}`}
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
              className={`flex items-center gap-3 border-b border-surface-2 px-4 py-3 ${
                mine ? 'bg-brand/[0.07]' : ''
              } ${href ? 'transition-colors active:bg-surface-2' : ''}`}
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
