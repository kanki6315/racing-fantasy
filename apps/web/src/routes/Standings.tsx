import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  useChampionships,
  useRoundLeaderboard,
  useRounds,
  useSeasonLeaderboard,
  useSeasons,
} from '../api/queries'
import { BoardStatus, Leaderboard } from '../components/Leaderboard'
import { FilterRow, FilterTab, RoundFilter } from '../components/StandingsFilters'
import { YourPosition } from '../components/YourPosition'
import { param, useParamWriter } from '../lib/urlState'
import { ErrorBox, SkeletonTable } from './LeagueStandings'

/**
 * F3 season standings, multi-championship. Three filter levels — Championship → Year → Total/round —
 * so any series' board is reachable.
 *
 * **`?champ=&season=&round=` is the state**, not a seed for it. Reading the params on mount and then
 * letting local state own them meant the URL never changed: Back couldn't undo a filter, and a board
 * you'd drilled four clicks into couldn't be linked to anyone — while the Landing calendar was
 * already sending finished weekends here by round id, so the deep link worked inbound and silently
 * died on arrival. Every level now reads from the URL and writes back to it.
 */
export function Standings() {
  const { user } = useAuth()
  const { data: champs = [] } = useChampionships()
  const [search] = useSearchParams()

  const champId = param(search.get('champ'))
  const seasonId = param(search.get('season'))
  const tab: 'season' | number = param(search.get('round')) ?? 'season'

  // Push/replace semantics live in the shared writer (see lib/urlState).
  const setParams = useParamWriter()

  // Championship — default/heal to the first (lowest sort order). It heals `champ` and nothing else:
  // a hand-written `?round=13` with no champ is still a deep link, and clearing its siblings here to
  // "tidy up" would destroy it before the levels below ever got to validate it.
  useEffect(() => {
    if (champs.length === 0) return
    if (champId == null || !champs.some((c) => c.id === champId)) {
      setParams({ champ: champs[0].id }, 'replace')
    }
  }, [champs, champId, setParams])

  // Year — default/heal to the newest season of the selected championship.
  const seasonsQ = useSeasons(champId ?? undefined)
  // Memoised so the `?? []` fallback isn't a fresh array on every render, which would re-run the
  // heal effect below each time.
  const seasons = useMemo(() => seasonsQ.data ?? [], [seasonsQ.data])
  useEffect(() => {
    // Only heal once the list has actually arrived — an in-flight query looks identical to "this
    // series has no seasons", and clearing the selection mid-load throws away a `?season=` seed.
    if (!seasonsQ.isSuccess) return
    if (seasons.length === 0) {
      if (seasonId != null) setParams({ season: null }, 'replace')
      return
    }
    if (seasonId == null || !seasons.some((s) => s.id === seasonId)) {
      setParams({ season: [...seasons].sort((a, b) => b.year - a.year)[0].id }, 'replace')
    }
  }, [seasonsQ.isSuccess, seasons, seasonId, setParams])

  // A round tab is only trusted once this season's round list has arrived. A `?round=` from a stale
  // link or the wrong series falls back to the season pool — derived rather than healed into state,
  // so no doomed leaderboard request is ever made for it.
  const rounds = useRounds(seasonId ?? undefined)
  const roundPending = typeof tab === 'number' && !rounds.data
  const roundOk = typeof tab === 'number' && !!rounds.data && rounds.data.some((r) => r.id === tab)
  const view: 'season' | number = roundOk || roundPending ? tab : 'season'

  // ...and once the list *has* arrived and the round still isn't in it, drop it from the URL. The
  // board already fell back to the season pool; leaving `?round=999` in the address bar would have
  // the URL describing a view nobody is looking at, and copying it would pass the lie on.
  useEffect(() => {
    if (typeof tab !== 'number' || !rounds.isSuccess) return
    if (!rounds.data.some((r) => r.id === tab)) setParams({ round: null }, 'replace')
  }, [tab, rounds.isSuccess, rounds.data, setParams])

  // Changing a level clears the levels below it: a round id belongs to exactly one season, and a
  // season to one series. This replaces the previous-value ref that used to watch for season changes
  // reactively — the reset belongs to the click that caused it, where it can't be confused with the
  // initial null → resolved settle.
  const pickChamp = (id: number) => setParams({ champ: id, season: null, round: null }, 'push')
  const pickSeason = (id: number) => setParams({ season: id, round: null }, 'push')
  const pickRound = (v: 'season' | number) => setParams({ round: v === 'season' ? null : v }, 'push')

  const season = useSeasonLeaderboard(view === 'season' ? (seasonId ?? undefined) : undefined)
  const round = useRoundLeaderboard(roundOk ? tab : undefined)
  const active$ = view === 'season' ? season : round
  // While a deep-linked round is still unverified its query is idle, not loading — keep the skeleton
  // up rather than flashing an empty board.
  const boardLoading = active$.isLoading || roundPending

  const myReg = user?.registrations.find((r) => r.seasonId === seasonId)
  const myRegId = myReg?.id
  const champ = champs.find((c) => c.id === champId)
  const season$ = seasons.find((s) => s.id === seasonId)
  const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year)

  // One sentence naming the board, for the live region and the table's accessible name. Both need
  // the same words; deriving it once keeps them from drifting.
  const roundName = typeof view === 'number' ? rounds.data?.find((r) => r.id === view)?.name : undefined
  const boardName = `${champ?.name ?? 'Standings'}${season$ ? ` ${season$.year}` : ''} — ${
    roundName ?? 'season total'
  }`
  // Rows drill into a lineup only from a per-round board, and only for signed-in viewers. Computed
  // once so the board and the bug agree about which column layout they are on.
  const linked = !!user && typeof view === 'number'
  const entryCount = active$.data?.entries.length ?? 0
  const boardStatus = boardLoading
    ? 'Loading standings…'
    : active$.isError
      ? "Couldn't load these standings."
      : `${boardName}. ${entryCount} ${entryCount === 1 ? 'team' : 'teams'}.`

  return (
    <div className="mx-auto max-w-[860px] px-4 py-7 sm:px-[26px]">
      <div className="flex items-center gap-[13px]">
        <span className="h-[28px] w-[6px] flex-none bg-brand [transform:skewX(-14deg)]" />
        <div>
          <h1 className="font-display text-[30px] font-extrabold uppercase leading-none text-ink">Standings</h1>
          <div className="mt-[6px] font-sans text-[12px] text-muted">
            {champ ? `${champ.name}${season$ ? ` · ${season$.year}` : ''}` : 'Season pool & per-round boards'}
          </div>
        </div>
      </div>

      {/* Championship → Year selectors */}
      <div className="mt-6 flex flex-col gap-3">
        <FilterRow label="Series">
          {champs.map((c) => (
            <FilterTab key={c.id} active={c.id === champId} onClick={() => pickChamp(c.id)}>
              {c.name}
            </FilterTab>
          ))}
        </FilterRow>
        {/* A filter offering one choice isn't a filter. Most series carry a single season today, so
            this row was usually a labelled row containing the word "2026" and nothing to do — and the
            year it states is already in the subtitle above. It appears when there's a year to pick. */}
        {sortedSeasons.length > 1 && (
          <FilterRow label="Year">
            {sortedSeasons.map((s) => (
              <FilterTab key={s.id} active={s.id === seasonId} onClick={() => pickSeason(s.id)}>
                {s.year}
              </FilterTab>
            ))}
          </FilterRow>
        )}
      </div>

      {/* Total | round sub-filter */}
      <div className="mt-5">
        <RoundFilter rounds={rounds.data ?? []} value={view} onChange={pickRound} />
      </div>

      <BoardStatus text={boardStatus} />

      <div className="mt-6">
        {/* The page had exactly one heading, so heading navigation — a primary screen-reader way of
            skipping to content — could not reach the board at all. Visually hidden: the board is
            self-evident on screen and the page just spent a pass removing chrome. */}
        <h2 className="sr-only">Leaderboard</h2>
        {!champ ? (
          <ErrorBox message="No championships found." />
        ) : seasonId == null ? (
          <ErrorBox message="This series has no seasons yet." />
        ) : boardLoading ? (
          <SkeletonTable />
        ) : active$.isError ? (
          <ErrorBox
            message="Couldn't load these standings."
            onRetry={() => void active$.refetch()}
            retrying={active$.isFetching}
          />
        ) : (
          // The bug and the board share this parent so `position: sticky` has the board's full height
          // to travel through — scoped to its own block, it would pin for 52px and stop.
          <>
            <YourPosition
              entries={active$.data?.entries ?? []}
              myRegistrationId={myRegId}
              myTeamName={myReg?.teamName}
              scope={view === 'season' ? 'season' : 'round'}
              registerSeasonId={user && seasonId != null && myRegId == null ? seasonId : undefined}
              linked={linked}
            />
            <Leaderboard
              entries={active$.data?.entries ?? []}
              myRegistrationId={myRegId}
              caption={boardName}
              // Drill into a player's lineup only from a per-round board, where the round is unambiguous
              // (and, being scored, already locked). The season "Total" view has no single round to show.
              // Gated on auth: the detail page is RequireAuth, so don't offer the link (or its hover) to
              // logged-out visitors — they'd only be bounced home.
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
                  ? 'The season pool is empty — standings appear once the first round is scored.'
                  : 'This round has no scores yet.'
              }
            />
            {/* Answers the question the board itself raises: rows drill into a lineup on a per-round
                board and sit inert here, with nothing on screen saying why. Only for signed-in
                viewers — picking a round doesn't unlock the link for anyone else. */}
            {view === 'season' && user && (rounds.data?.length ?? 0) > 0 && (active$.data?.entries.length ?? 0) > 0 && (
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
