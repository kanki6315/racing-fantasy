import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  useActiveSeason,
  useRoundLeaderboard,
  useRounds,
  useSeasonLeaderboard,
} from '../api/queries'
import { Leaderboard } from '../components/Leaderboard'
import { ErrorBox, SkeletonTable } from './LeagueStandings'

/** F3 season standings — public season pool + per-round boards, with a tab toggle. */
export function Standings() {
  const { user } = useAuth()
  const { data: active } = useActiveSeason()
  const seasonId = active?.season.id
  const rounds = useRounds(seasonId)

  // 'season' = season-wide pool; a number = that round's board.
  const [tab, setTab] = useState<'season' | number>('season')

  const season = useSeasonLeaderboard(tab === 'season' ? seasonId : undefined)
  const round = useRoundLeaderboard(typeof tab === 'number' ? tab : undefined)
  const active$ = tab === 'season' ? season : round

  const myRegId = user?.registrations.find((r) => r.seasonId === seasonId)?.id

  return (
    <div className="mx-auto max-w-[860px] px-4 py-7 sm:px-[26px]">
      <div className="flex items-center gap-[13px]">
        <span className="h-[28px] w-[6px] flex-none bg-brand [transform:skewX(-14deg)]" />
        <div>
          <h1 className="font-display text-[30px] font-extrabold italic uppercase leading-none text-ink">Standings</h1>
          <div className="mt-[6px] font-sans text-[12px] text-muted">
            {active ? `${active.championship.name} · ${active.season.year}` : 'Season pool & per-round boards'}
          </div>
        </div>
      </div>

      {/* tabs: season pool + each round */}
      <div className="mt-6 flex flex-wrap gap-[6px] border-b border-line pb-[14px]">
        <Tab active={tab === 'season'} onClick={() => setTab('season')}>Season</Tab>
        {(rounds.data ?? []).map((r) => (
          <Tab key={r.id} active={tab === r.id} onClick={() => setTab(r.id)}>
            {r.name}
          </Tab>
        ))}
      </div>

      <div className="mt-6">
        {!active ? (
          <ErrorBox message="No active season found." />
        ) : active$.isLoading ? (
          <SkeletonTable />
        ) : active$.isError ? (
          <ErrorBox message="Couldn't load these standings." />
        ) : (
          <Leaderboard
            entries={active$.data?.entries ?? []}
            myRegistrationId={myRegId}
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

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-[3px] px-[14px] font-display text-[13px] font-semibold uppercase tracking-[0.04em] transition-colors cursor-pointer ${
        active ? 'bg-brand text-ink' : 'border border-line-2 text-muted hover:text-ink-2'
      }`}
    >
      {children}
    </button>
  )
}
