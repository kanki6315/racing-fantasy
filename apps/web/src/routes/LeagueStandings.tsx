import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLeague, useLeagueLeaderboard } from '../api/queries'
import { Leaderboard } from '../components/Leaderboard'

/** F3 league standings — the real page behind the dashboard "Standings" links. */
export function LeagueStandings() {
  const { id } = useParams()
  const leagueId = Number(id)
  const { user } = useAuth()
  const league = useLeague(leagueId)
  const lb = useLeagueLeaderboard(leagueId)

  // A user has at most one registration per season, so the league's season pins my row.
  const myRegId = user?.registrations.find((r) => r.seasonId === league.data?.seasonId)?.id
  const isPrivate = league.data?.visibility === 'Private'

  return (
    <div className="mx-auto max-w-[860px] px-[26px] py-7">
      <Link to="/dashboard" className="font-mono text-[11px] tracking-[0.08em] uppercase text-muted hover:text-ink-2 transition-colors">
        ← Back to My Team
      </Link>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex items-center gap-[13px]">
          <span className="h-[28px] w-[6px] flex-none bg-brand [transform:skewX(-14deg)]" />
          <div>
            <h1 className="font-display text-[30px] font-extrabold italic uppercase leading-none text-ink">
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
          <div className="rounded-[3px] border border-line-2 bg-surface px-[14px] py-[8px] text-right">
            <div className="font-display text-[10px] tracking-[0.12em] uppercase text-muted-2">Join Code</div>
            <div className="font-mono text-[15px] font-bold tracking-[0.1em] text-ink">{league.data.joinCode}</div>
          </div>
        )}
      </div>

      <div className="mt-6">
        {lb.isLoading ? (
          <SkeletonTable />
        ) : lb.isError ? (
          <ErrorBox message="Couldn't load these standings." />
        ) : (
          <Leaderboard
            entries={lb.data?.entries ?? []}
            myRegistrationId={myRegId}
            showName={isPrivate}
            emptyMessage="No standings yet — they fill in once a round is scored."
          />
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
