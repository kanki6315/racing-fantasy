import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  useChampionships,
  useRoundLeaderboard,
  useRounds,
  useSeasonLeaderboard,
  useSeasons,
} from '../api/queries'
import { Leaderboard } from '../components/Leaderboard'
import { FilterRow, FilterTab, RoundFilter } from '../components/StandingsFilters'
import { ErrorBox, SkeletonTable } from './LeagueStandings'

/** `?champ=&season=&round=` → a number, when it's actually a number. */
function param(v: string | null): number | null {
  const n = Number(v)
  return v != null && v !== '' && Number.isInteger(n) ? n : null
}

/**
 * F3 season standings, now multi-championship. Three filter levels — Championship → Year → Total/round —
 * replace the old single "active season" anchor, so any series' board is reachable.
 *
 * The three levels also seed from `?champ=&season=&round=`, so other surfaces can deep-link a
 * specific board (the Landing calendar sends a finished weekend straight to its own round). The
 * params are read once as initial state; the filter pills own it from there.
 */
export function Standings() {
  const { user } = useAuth()
  const { data: champs = [] } = useChampionships()
  const [search] = useSearchParams()

  // Championship — default/heal to the first (lowest sort order).
  const [champId, setChampId] = useState<number | null>(() => param(search.get('champ')))
  useEffect(() => {
    if (champs.length === 0) return
    if (champId == null || !champs.some((c) => c.id === champId)) setChampId(champs[0].id)
  }, [champs, champId])

  // Year — default/heal to the newest season of the selected championship.
  const seasonsQ = useSeasons(champId ?? undefined)
  const seasons = seasonsQ.data ?? []
  const [seasonId, setSeasonId] = useState<number | null>(() => param(search.get('season')))
  useEffect(() => {
    // Only heal once the list has actually arrived — an in-flight query looks identical to "this
    // series has no seasons", and clearing the selection mid-load throws away a `?season=` seed.
    if (!seasonsQ.isSuccess) return
    if (seasons.length === 0) {
      setSeasonId(null)
      return
    }
    if (seasonId == null || !seasons.some((s) => s.id === seasonId)) {
      setSeasonId([...seasons].sort((a, b) => b.year - a.year)[0].id)
    }
  }, [seasonsQ.isSuccess, seasons, seasonId])

  // Total | round — seeded from `?round=`, then reset to season-wide whenever the user *changes* the
  // season (tracking the previous value, so the initial null → resolved-season settle doesn't count
  // as a change and clobber a deep link).
  const rounds = useRounds(seasonId ?? undefined)
  const [tab, setTab] = useState<'season' | number>(() => param(search.get('round')) ?? 'season')
  const prevSeason = useRef<number | null>(null)
  useEffect(() => {
    if (prevSeason.current != null && prevSeason.current !== seasonId) setTab('season')
    prevSeason.current = seasonId
  }, [seasonId])

  // A round tab is only trusted once this season's round list has arrived. A `?round=` from a stale
  // link or the wrong series falls back to the season pool — derived rather than healed into state,
  // so no doomed leaderboard request is ever made for it.
  const roundPending = typeof tab === 'number' && !rounds.data
  const roundOk = typeof tab === 'number' && !!rounds.data && rounds.data.some((r) => r.id === tab)
  const view: 'season' | number = roundOk || roundPending ? tab : 'season'

  const season = useSeasonLeaderboard(view === 'season' ? (seasonId ?? undefined) : undefined)
  const round = useRoundLeaderboard(roundOk ? tab : undefined)
  const active$ = view === 'season' ? season : round
  // While a deep-linked round is still unverified its query is idle, not loading — keep the skeleton
  // up rather than flashing an empty board.
  const boardLoading = active$.isLoading || roundPending

  const myRegId = user?.registrations.find((r) => r.seasonId === seasonId)?.id
  const champ = champs.find((c) => c.id === champId)
  const season$ = seasons.find((s) => s.id === seasonId)
  const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year)

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
            <FilterTab key={c.id} active={c.id === champId} onClick={() => setChampId(c.id)}>
              {c.name}
            </FilterTab>
          ))}
        </FilterRow>
        {sortedSeasons.length > 0 && (
          <FilterRow label="Year">
            {sortedSeasons.map((s) => (
              <FilterTab key={s.id} active={s.id === seasonId} onClick={() => setSeasonId(s.id)}>
                {s.year}
              </FilterTab>
            ))}
          </FilterRow>
        )}
      </div>

      {/* Total | round sub-filter */}
      <div className="mt-5">
        <RoundFilter rounds={rounds.data ?? []} value={view} onChange={setTab} />
      </div>

      <div className="mt-6">
        {!champ ? (
          <ErrorBox message="No championships found." />
        ) : seasonId == null ? (
          <ErrorBox message="This series has no seasons yet." />
        ) : boardLoading ? (
          <SkeletonTable />
        ) : active$.isError ? (
          <ErrorBox message="Couldn't load these standings." />
        ) : (
          <Leaderboard
            entries={active$.data?.entries ?? []}
            myRegistrationId={myRegId}
            // Drill into a player's lineup only from a per-round board, where the round is unambiguous
            // (and, being scored, already locked). The season "Total" view has no single round to show.
            // Gated on auth: the detail page is RequireAuth, so don't offer the link (or its hover) to
            // logged-out visitors — they'd only be bounced home.
            rowHref={
              user && typeof view === 'number'
                ? (e) => `/standings/team/${e.registrationId}/round/${view}`
                : undefined
            }
            emptyMessage={
              view === 'season'
                ? 'The season pool is empty — standings appear once the first round is scored.'
                : 'This round has no scores yet.'
            }
          />
        )}
      </div>
    </div>
  )
}
