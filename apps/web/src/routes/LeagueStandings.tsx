import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLeague, useLeagueLeaderboard, useRounds } from '../api/queries'
import { BoardStatus, Leaderboard } from '../components/Leaderboard'
import { RoundFilter } from '../components/StandingsFilters'
import { YourPosition } from '../components/YourPosition'

/** F3 league standings — the real page behind the dashboard "Standings" links. */
export function LeagueStandings() {
  const { id } = useParams()
  const leagueId = Number(id)
  const { user } = useAuth()
  const league = useLeague(leagueId)

  // Championship + year are fixed by the league's season; the Total | round sub-filter mirrors the
  // season standings page — including living in `?round=`, so "here's where you are in our league
  // after Petit" is a link you can paste, which is most of the point of a private league.
  const rounds = useRounds(league.data?.seasonId)
  const [search, setSearch] = useSearchParams()
  const raw = Number(search.get('round'))
  const tab: 'season' | number = search.get('round') && Number.isInteger(raw) ? raw : 'season'
  const setTab = (v: 'season' | number) => {
    const p = new URLSearchParams(search)
    if (v === 'season') p.delete('round')
    else p.set('round', String(v))
    setSearch(p)
  }
  // Only ask for a round this league's season actually has; a stale link falls back to the pool.
  // `view` is what's on screen — everything downstream keys off it rather than off `tab`, or a
  // `?round=` pointing at another season's round would leave the board showing season totals while
  // the rows still linked into a round that isn't in this league.
  const roundOk = typeof tab === 'number' && !!rounds.data && rounds.data.some((r) => r.id === tab)
  const roundPending = typeof tab === 'number' && !rounds.data
  const view: 'season' | number = roundOk || roundPending ? tab : 'season'
  const lb = useLeagueLeaderboard(leagueId, roundOk ? tab : undefined)

  // Same as the season board: once the round list is in and the round isn't in it, stop claiming it.
  useEffect(() => {
    if (typeof tab !== 'number' || !rounds.isSuccess) return
    if (!rounds.data.some((r) => r.id === tab)) {
      const p = new URLSearchParams(search)
      p.delete('round')
      setSearch(p, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rounds.isSuccess, rounds.data])

  // A user has at most one registration per season, so the league's season pins my row.
  const myReg = user?.registrations.find((r) => r.seasonId === league.data?.seasonId)
  const myRegId = myReg?.id
  const isPrivate = league.data?.visibility === 'Private'

  // Same derivation as the season board, so both surfaces name themselves the same way.
  const roundName = typeof view === 'number' ? rounds.data?.find((r) => r.id === view)?.name : undefined
  const boardName = `${lb.data?.name ?? league.data?.name ?? 'League'} — ${roundName ?? 'season total'}`
  const linked = !!user && typeof view === 'number'
  const entryCount = lb.data?.entries.length ?? 0
  const boardStatus =
    lb.isLoading || roundPending
      ? 'Loading standings…'
      : lb.isError
        ? "Couldn't load these standings."
        : `${boardName}. ${entryCount} ${entryCount === 1 ? 'team' : 'teams'}.`

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
        <RoundFilter rounds={rounds.data ?? []} value={view} onChange={setTab} />
      </div>

      <BoardStatus text={boardStatus} />

      <div className="mt-6">
        <h2 className="sr-only">Leaderboard</h2>
        {lb.isLoading || roundPending ? (
          <SkeletonTable />
        ) : lb.isError ? (
          <ErrorBox
            message="Couldn't load these standings."
            onRetry={() => void lb.refetch()}
            retrying={lb.isFetching}
          />
        ) : (
          // Shared parent so the bug's `position: sticky` has the board's height to travel through.
          // No `registerSeasonId` here on purpose: registering for the season doesn't join *this*
          // league, so offering it from a league board would promise something it can't deliver.
          <>
            <YourPosition
              entries={lb.data?.entries ?? []}
              myRegistrationId={myRegId}
              myTeamName={myReg?.teamName}
              scope={view === 'season' ? 'season' : 'round'}
              showName={isPrivate}
              linked={linked}
            />
            <Leaderboard
              entries={lb.data?.entries ?? []}
              myRegistrationId={myRegId}
              showName={isPrivate}
              caption={boardName}
              // Same as the season standings board: drill into a team's lineup only from a per-round view
              // (the round is unambiguous and, being scored, locked). Season-total rows don't link.
              rowHref={linked ? (e) => `/standings/team/${e.registrationId}/round/${view}` : undefined}
              emptyAction={
                <Link
                  to="/"
                  className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted transition-colors hover:text-ink-2"
                >
                  See the race calendar →
                </Link>
              }
              emptyMessage={
                view === 'season'
                  ? 'No standings yet — they fill in once a round is scored.'
                  : 'This round has no scores yet.'
              }
            />
            {/* Answers the question the board itself raises: rows drill into a lineup on a per-round
                board and sit inert here, with nothing on screen saying why. Only for signed-in
                viewers — picking a round doesn't unlock the link for anyone else. */}
            {view === 'season' && user && (rounds.data?.length ?? 0) > 0 && (lb.data?.entries.length ?? 0) > 0 && (
              <p className="mt-3 font-sans text-[12px] text-muted">
                Pick a round above to see each team's lineup.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Placeholder shaped like the table it stands in for.
 *
 * It used to be six 46px bars with no header band, so the real board's `surface-3` header and its
 * 51px rows pushed everything down the moment data landed — the layout shift was the loading state's
 * parting gift. Matching the header height and the row height keeps the top of the table still.
 * `aria-hidden` because it is pulse bars with no text; the live region already says "Loading
 * standings…".
 */
export function SkeletonTable() {
  return (
    <div aria-hidden className="overflow-hidden rounded-[4px] border border-line bg-surface">
      <div className="h-[38px] border-b border-line bg-surface-3" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[51px] animate-pulse border-b border-line bg-surface-2/40" />
      ))}
    </div>
  )
}

/**
 * A failed board with no way back. `onRetry` turns "Couldn't load these standings" from a dead end
 * into something a player can act on without reloading the page — a transient blip on a phone at a
 * circuit is the *typical* failure here, not the exotic one. The button is a ghost, not a second
 * danger-toned element: the box already carries the alarm, and two red things would compete.
 * It reports its own progress, because a retry that looks identical to not-retrying gets mashed.
 */
export function ErrorBox({
  message,
  onRetry,
  retrying = false,
}: {
  message: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div className="rounded-[4px] border border-danger/30 bg-danger/[0.06] px-5 py-8 text-center font-sans text-[13px] text-danger">
      {message}
      {onRetry && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="h-9 rounded-[3px] border border-line-2 px-4 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-2 transition-colors cursor-pointer hover:border-line-3 hover:text-ink disabled:cursor-default disabled:border-line disabled:text-muted pointer-coarse:h-11"
          >
            {retrying ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      )}
    </div>
  )
}
