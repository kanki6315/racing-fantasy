import { useEffect, useState } from 'react'
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

/**
 * F3 season standings, now multi-championship. Three filter levels — Championship → Year → Total/round —
 * replace the old single "active season" anchor, so any series' board is reachable.
 */
export function Standings() {
  const { user } = useAuth()
  const { data: champs = [] } = useChampionships()

  // Championship — default/heal to the first (lowest sort order).
  const [champId, setChampId] = useState<number | null>(null)
  useEffect(() => {
    if (champs.length === 0) return
    if (champId == null || !champs.some((c) => c.id === champId)) setChampId(champs[0].id)
  }, [champs, champId])

  // Year — default/heal to the newest season of the selected championship.
  const { data: seasons = [] } = useSeasons(champId ?? undefined)
  const [seasonId, setSeasonId] = useState<number | null>(null)
  useEffect(() => {
    if (seasons.length === 0) {
      setSeasonId(null)
      return
    }
    if (seasonId == null || !seasons.some((s) => s.id === seasonId)) {
      setSeasonId([...seasons].sort((a, b) => b.year - a.year)[0].id)
    }
  }, [seasons, seasonId])

  // Total | round — reset to season-wide whenever the season changes.
  const rounds = useRounds(seasonId ?? undefined)
  const [tab, setTab] = useState<'season' | number>('season')
  useEffect(() => setTab('season'), [seasonId])

  const season = useSeasonLeaderboard(tab === 'season' ? (seasonId ?? undefined) : undefined)
  const round = useRoundLeaderboard(typeof tab === 'number' ? tab : undefined)
  const active$ = tab === 'season' ? season : round

  const myRegId = user?.registrations.find((r) => r.seasonId === seasonId)?.id
  const champ = champs.find((c) => c.id === champId)
  const season$ = seasons.find((s) => s.id === seasonId)
  const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year)

  return (
    <div className="mx-auto max-w-[860px] px-4 py-7 sm:px-[26px]">
      <div className="flex items-center gap-[13px]">
        <span className="h-[28px] w-[6px] flex-none bg-brand [transform:skewX(-14deg)]" />
        <div>
          <h1 className="font-display text-[30px] font-extrabold italic uppercase leading-none text-ink">Standings</h1>
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
        <RoundFilter rounds={rounds.data ?? []} value={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        {!champ ? (
          <ErrorBox message="No championships found." />
        ) : seasonId == null ? (
          <ErrorBox message="This series has no seasons yet." />
        ) : active$.isLoading ? (
          <SkeletonTable />
        ) : active$.isError ? (
          <ErrorBox message="Couldn't load these standings." />
        ) : (
          <Leaderboard
            entries={active$.data?.entries ?? []}
            myRegistrationId={myRegId}
            // Drill into a player's lineup only from a per-round board, where the round is unambiguous
            // (and, being scored, already locked). The season "Total" view has no single round to show.
            rowHref={
              typeof tab === 'number'
                ? (e) => `/standings/team/${e.registrationId}/round/${tab}`
                : undefined
            }
            emptyMessage={
              tab === 'season'
                ? 'The season pool is empty — standings appear once the first round is scored.'
                : 'This round has no scores yet.'
            }
          />
        )}
      </div>
    </div>
  )
}
