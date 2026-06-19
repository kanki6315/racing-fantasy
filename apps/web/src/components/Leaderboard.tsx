import type { LeaderboardEntry } from '../api/queries'

/** Podium accent for the top three ranks; everyone else is plain ink. */
function rankColor(rank: number): string {
  if (rank === 1) return 'text-brand-2'
  if (rank === 2) return 'text-ink'
  if (rank === 3) return 'text-gtdpro-2'
  return 'text-ink-2'
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
}: {
  entries: LeaderboardEntry[]
  myRegistrationId?: number
  showName?: boolean
  emptyMessage?: string
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[4px] border border-dashed border-line-2 px-5 py-12 text-center font-sans text-[13px] text-muted">
        {emptyMessage}
      </div>
    )
  }

  const cols = showName
    ? 'grid-cols-[52px_1fr_minmax(0,1fr)_110px_90px]'
    : 'grid-cols-[52px_1fr_110px_90px]'

  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
      <div className={`grid ${cols} items-center border-b border-line bg-surface-3 px-[18px] py-[10px] font-display text-[11px] tracking-[0.1em] uppercase text-muted-2`}>
        <span>#</span>
        <span>Team</span>
        {showName && <span>Player</span>}
        <span className="text-right">Points</span>
        <span className="text-right">Rounds</span>
      </div>
      {entries.map((e) => {
        const mine = myRegistrationId != null && e.registrationId === myRegistrationId
        return (
          <div
            key={e.registrationId}
            className={`grid ${cols} items-center border-b border-surface-2 px-[18px] py-[13px] ${
              mine ? 'border-l-[3px] border-l-brand bg-brand/[0.06]' : ''
            }`}
          >
            <span className={`font-mono text-[16px] font-bold ${rankColor(e.rank)}`}>{e.rank}</span>
            <span className="flex items-center gap-2 truncate font-display text-[15px] font-bold uppercase tracking-[0.02em] text-ink">
              <span className={`h-[15px] w-[4px] flex-none [transform:skewX(-14deg)] ${mine ? 'bg-brand' : 'bg-line-3'}`} />
              <span className="truncate">{e.teamName}</span>
              {mine && <span className="flex-none rounded-[2px] bg-brand px-[6px] py-[1px] font-mono text-[9px] tracking-[0.08em] text-ink">YOU</span>}
            </span>
            {showName && <span className="truncate font-sans text-[12px] text-muted">{e.name ?? '—'}</span>}
            <span className="text-right font-mono text-[15px] font-semibold text-ink">{e.points.toFixed(1)}</span>
            <span className="text-right font-mono text-[12px] text-muted-2">{e.roundsScored}</span>
          </div>
        )
      })}
    </div>
  )
}
