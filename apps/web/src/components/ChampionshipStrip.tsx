import { useChampionships } from '../api/queries'
import { demoStats } from '../lib/demoStats'
import { Demo } from './Demo'

/** The live championships strip — the F0 proof that the app renders real API data. */
export function ChampionshipStrip() {
  const { data, isLoading, isError } = useChampionships()

  return (
    <div className="flex items-center gap-[10px] h-[50px] px-4 sm:px-[26px] bg-surface border-b border-line overflow-x-auto">
      <span className="font-display text-[12px] tracking-[0.16em] uppercase text-muted-2 mr-1 shrink-0">
        Championships
      </span>

      {isLoading && <span className="text-[13px] text-muted">Loading…</span>}
      {isError && <span className="text-[13px] text-danger">Couldn’t load championships</span>}

      {data?.map((c, i) => (
        <div
          key={c.id}
          className="flex items-center gap-2 h-[30px] px-3 bg-surface-2 border border-line-2 rounded-[3px] shrink-0"
        >
          <div
            className={`h-4 w-[5px] [transform:skewX(-14deg)] ${i === 0 ? 'bg-brand' : 'bg-muted'}`}
          />
          <span
            className={`font-display font-bold text-[12px] uppercase ${i === 0 ? 'text-ink' : 'text-ink-2'}`}
          >
            {c.name}
          </span>
        </div>
      ))}

      <div className="flex-1" />
      <Demo className="hidden shrink-0 sm:inline-flex">
        <span className="text-[13px] text-muted-2 whitespace-nowrap">
          {demoStats.global.players.toLocaleString()} players · {demoStats.global.leagues} leagues
        </span>
      </Demo>
    </div>
  )
}
