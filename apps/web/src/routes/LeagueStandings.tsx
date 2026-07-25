import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLeague, useLeagueLeaderboard, useRounds } from '../api/queries'
import { Leaderboard } from '../components/Leaderboard'
import { RoundFilter } from '../components/StandingsFilters'
import { YourPosition } from '../components/YourPosition'

/** F3 league standings — the real page behind the dashboard "Standings" links. */
export function LeagueStandings() {
  const { id } = useParams()
  const leagueId = Number(id)
  const { user } = useAuth()
  const league = useLeague(leagueId)

  // Championship + year are fixed by the league's season; the Total | round sub-filter mirrors the
  // season standings page.
  const rounds = useRounds(league.data?.seasonId)
  const [tab, setTab] = useState<'season' | number>('season')
  const lb = useLeagueLeaderboard(leagueId, typeof tab === 'number' ? tab : undefined)

  // A user has at most one registration per season, so the league's season pins my row.
  const myReg = user?.registrations.find((r) => r.seasonId === league.data?.seasonId)
  const myRegId = myReg?.id
  const isPrivate = league.data?.visibility === 'Private'

  return (
    <div className="mx-auto max-w-[860px] px-4 py-7 sm:px-[26px]">
      <Link to="/dashboard" className="font-mono text-[11px] tracking-[0.08em] uppercase text-muted hover:text-ink-2 transition-colors">
        ← Back to My Team
      </Link>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-[13px]">
          <span className="h-[28px] w-[6px] flex-none bg-brand [transform:skewX(-14deg)]" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-[26px] font-extrabold uppercase leading-none text-ink sm:text-[30px]">
              {lb.data?.name ?? league.data?.name ?? 'League'}
            </h1>
            {league.data && (
              <div className="mt-[6px] font-sans text-[12px] text-muted">
                {league.data.visibility} · {league.data.memberCount} players
              </div>
            )}
          </div>
        </div>
        {isPrivate && league.data?.joinCode && (
          <div className="shrink-0 self-start rounded-[3px] border border-line-2 bg-surface px-[14px] py-[8px] sm:self-auto sm:text-right">
            <div className="font-display text-[10px] tracking-[0.12em] uppercase text-muted">Join Code</div>
            <div className="font-mono text-[15px] font-bold tracking-[0.1em] text-ink">{league.data.joinCode}</div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <RoundFilter rounds={rounds.data ?? []} value={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        {lb.isLoading ? (
          <SkeletonTable />
        ) : lb.isError ? (
          <ErrorBox message="Couldn't load these standings." />
        ) : (
          // Shared parent so the bug's `position: sticky` has the board's height to travel through.
          // No `registerSeasonId` here on purpose: registering for the season doesn't join *this*
          // league, so offering it from a league board would promise something it can't deliver.
          <>
            <YourPosition
              entries={lb.data?.entries ?? []}
              myRegistrationId={myRegId}
              myTeamName={myReg?.teamName}
              scope={tab === 'season' ? 'season' : 'round'}
              showName={isPrivate}
            />
            <Leaderboard
              entries={lb.data?.entries ?? []}
              myRegistrationId={myRegId}
              showName={isPrivate}
              // Same as the season standings board: drill into a team's lineup only from a per-round view
              // (the round is unambiguous and, being scored, locked). Season-total rows don't link.
              rowHref={
                user && typeof tab === 'number'
                  ? (e) => `/standings/team/${e.registrationId}/round/${tab}`
                  : undefined
              }
              emptyMessage={
                tab === 'season'
                  ? 'No standings yet — they fill in once a round is scored.'
                  : 'This round has no scores yet.'
              }
            />
          </>
        )}
      </div>
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[46px] animate-pulse border-b border-surface-2 bg-surface-2/40" />
      ))}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-[4px] border border-danger/30 bg-danger/[0.06] px-5 py-8 text-center font-sans text-[13px] text-danger">
      {message}
    </div>
  )
}
