import { useEffect, useMemo, useState } from 'react'
import {
  useChampionships,
  useRosterRules,
  useRoundStats,
  useRounds,
  useSeasons,
} from '../api/queries'
import type { RoundStats } from '../api/queries'
import { FilterRow, FilterTab } from '../components/StandingsFilters'
import { classMeta } from '../lib/classMeta'
import { ErrorBox, SkeletonTable } from './LeagueStandings'

type EntityStat = RoundStats['entities'][number]
type Row = { e: EntityStat; primary: string; secondary?: string; bar?: number }

/** "DOUBLE_POINTS_TEAM" / "DoublePointsTeam" → "Double Points Team". */
function prettyKind(kind: string): string {
  return kind
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Public Stats page — analytic, post-lock breakdowns for a single round: top-10 Most Picked, Top
 * Scorers and Best Value, each respecting a class filter, plus the field's score context and bonus
 * usage. Champ → Year → Round selectors mirror the Standings page. The stats endpoint is lock-gated
 * (returns null until qualifying), so the page shows a neutral "locked" state before then.
 */
export function Stats() {
  const { data: champs = [] } = useChampionships()

  const [champId, setChampId] = useState<number | null>(null)
  useEffect(() => {
    if (champs.length === 0) return
    if (champId == null || !champs.some((c) => c.id === champId)) setChampId(champs[0].id)
  }, [champs, champId])

  const { data: seasons = [] } = useSeasons(champId ?? undefined)
  const sortedSeasons = useMemo(() => [...seasons].sort((a, b) => b.year - a.year), [seasons])
  const [seasonId, setSeasonId] = useState<number | null>(null)
  useEffect(() => {
    if (seasons.length === 0) {
      setSeasonId(null)
      return
    }
    if (seasonId == null || !seasons.some((s) => s.id === seasonId)) setSeasonId(sortedSeasons[0].id)
  }, [seasons, sortedSeasons, seasonId])

  const rounds = useRounds(seasonId ?? undefined)
  const roundList = useMemo(
    () => [...(rounds.data ?? [])].sort((a, b) => a.sequence - b.sequence),
    [rounds.data],
  )
  const [roundId, setRoundId] = useState<number | null>(null)
  useEffect(() => {
    if (roundList.length === 0) {
      setRoundId(null)
      return
    }
    if (roundId != null && roundList.some((r) => r.id === roundId)) return
    // Default to the latest *locked* round (its stats are populated); else the latest round.
    const now = Date.now()
    const locked = roundList.filter((r) => new Date(r.qualiStart).getTime() <= now)
    setRoundId((locked.length ? locked : roundList).at(-1)!.id)
  }, [roundList, roundId])

  const stats$ = useRoundStats(roundId ?? undefined)
  const rules = useRosterRules(roundId ?? 0)

  const [classId, setClassId] = useState<number | 'all'>('all')
  useEffect(() => setClassId('all'), [roundId])

  const colorFor = (cid: number) => {
    const c = rules.data?.classes.find((x) => x.classId === cid)
    return classMeta(c?.name, c?.color).hex
  }
  const labelFor = (cid: number) => {
    const c = rules.data?.classes.find((x) => x.classId === cid)
    return classMeta(c?.name, c?.color).label
  }

  const stats = stats$.data
  const entities = stats?.entities ?? []

  // Class chips: only classes that actually have picked entities this round.
  const classIds = useMemo(() => {
    const present = new Set(entities.map((e) => e.classId))
    const ordered = (rules.data?.classes ?? []).map((c) => c.classId).filter((id) => present.has(id))
    // Include any present class not in the rules list (defensive), keeping rules order first.
    return [...ordered, ...[...present].filter((id) => !ordered.includes(id))]
  }, [entities, rules.data])

  const inClass = (e: EntityStat) => classId === 'all' || e.classId === classId

  const mostPicked: Row[] = useMemo(
    () =>
      entities
        .filter(inClass)
        .sort((a, b) => b.pickCount - a.pickCount)
        .slice(0, 10)
        .map((e) => ({ e, primary: `${e.pickPct.toFixed(0)}%`, secondary: `${e.pickCount} picks`, bar: e.pickPct })),
    [entities, classId],
  )

  const topScorers: Row[] = useMemo(
    () =>
      entities
        .filter((e) => inClass(e) && e.points != null)
        .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
        .slice(0, 10)
        .map((e) => ({ e, primary: `${e.points!.toFixed(1)}`, secondary: 'pts' })),
    [entities, classId],
  )

  const bestValue: Row[] = useMemo(
    () =>
      entities
        .filter((e) => inClass(e) && e.points != null && e.price != null && e.price > 0)
        .sort((a, b) => b.points! / b.price! - a.points! / a.price!)
        .slice(0, 10)
        .map((e) => ({
          e,
          primary: `${(e.points! / e.price!).toFixed(2)}`,
          secondary: `${e.points!.toFixed(0)}pt · $${e.price!.toFixed(1)}`,
        })),
    [entities, classId],
  )

  const champ = champs.find((c) => c.id === champId)
  const season$ = seasons.find((s) => s.id === seasonId)
  const round$ = roundList.find((r) => r.id === roundId)

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-7 sm:px-[26px]">
      <div className="flex items-center gap-[13px]">
        <span className="h-[28px] w-[6px] flex-none bg-brand [transform:skewX(-14deg)]" />
        <div>
          <h1 className="font-display text-[30px] font-extrabold italic uppercase leading-none text-ink">Stats</h1>
          <div className="mt-[6px] font-sans text-[12px] text-muted">
            {champ ? `${champ.name}${season$ ? ` · ${season$.year}` : ''}${round$ ? ` · ${round$.name}` : ''}` : 'Per-round picks & scoring breakdowns'}
          </div>
        </div>
      </div>

      {/* Championship → Year → Round selectors */}
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
        {roundList.length > 0 && (
          <FilterRow label="Round">
            {roundList.map((r) => (
              <FilterTab key={r.id} active={r.id === roundId} onClick={() => setRoundId(r.id)}>
                {r.name}
              </FilterTab>
            ))}
          </FilterRow>
        )}
      </div>

      <div className="mt-6">
        {!champ ? (
          <ErrorBox message="No championships found." />
        ) : roundId == null ? (
          <ErrorBox message="This series has no rounds yet." />
        ) : stats$.isLoading ? (
          <SkeletonTable />
        ) : stats$.isError ? (
          <ErrorBox message="Couldn't load these stats." />
        ) : stats == null ? (
          <LockedState />
        ) : stats.rosters === 0 || entities.length === 0 ? (
          <ErrorBox message="No picks for this round yet." />
        ) : (
          <>
            {/* Field context + bonus usage */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[4px] border border-line bg-surface-3 px-[18px] py-[11px] font-mono text-[12px] text-muted-2">
              <Metric label="entered" value={`${stats.rosters}`} />
              {stats.highScore != null && <Metric label="high" value={stats.highScore.toFixed(1)} />}
              {stats.avgScore != null && <Metric label="avg" value={stats.avgScore.toFixed(1)} />}
              {stats.modifiers.map((m) => (
                <Metric
                  key={m.kind}
                  label={`${prettyKind(m.kind)} · ${m.usagePct.toFixed(0)}%`}
                  value={m.avgBonus != null ? `+${m.avgBonus.toFixed(1)}` : '—'}
                />
              ))}
            </div>

            {/* Class filter */}
            <div className="mt-4">
              <FilterRow label="Class">
                <FilterTab active={classId === 'all'} onClick={() => setClassId('all')}>
                  All
                </FilterTab>
                {classIds.map((cid) => (
                  <FilterTab key={cid} active={classId === cid} onClick={() => setClassId(cid)}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-[9px] w-[3px] [transform:skewX(-14deg)]" style={{ backgroundColor: colorFor(cid) }} />
                      {labelFor(cid)}
                    </span>
                  </FilterTab>
                ))}
              </FilterRow>
            </div>

            {/* Top-10 tables */}
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <StatTable title="Most Picked" rows={mostPicked} colorFor={colorFor} />
              <StatTable
                title="Top Scorers"
                rows={topScorers}
                colorFor={colorFor}
                empty="Scores land once the round is scored."
              />
              <StatTable
                title="Best Value"
                rows={bestValue}
                colorFor={colorFor}
                empty="Value lands once the round is scored."
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-ink-2">{value}</span> {label}
    </span>
  )
}

function LockedState() {
  return (
    <div className="rounded-[4px] border border-dashed border-line-2 px-5 py-12 text-center">
      <div className="font-display text-[13px] uppercase tracking-[0.1em] text-muted">Stats Locked</div>
      <p className="mt-2 font-sans text-[13px] text-muted-2">
        Pick breakdowns unlock when qualifying begins — held back so lineups can't be copied early.
      </p>
    </div>
  )
}

/** A single top-10 card: ranked rows with a class accent, name, and a primary/secondary metric. */
function StatTable({
  title,
  rows,
  colorFor,
  empty = 'No data.',
}: {
  title: string
  rows: Row[]
  colorFor: (classId: number) => string
  empty?: string
}) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
      <div className="border-b border-line bg-surface-3 px-[16px] py-[10px] font-display text-[11px] uppercase tracking-[0.12em] text-muted-2">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="px-[16px] py-8 text-center font-sans text-[12px] text-muted-2">{empty}</div>
      ) : (
        <ol>
          {rows.map(({ e, primary, secondary, bar }, i) => (
            <li
              key={`${e.entityType}-${e.entityId}`}
              className="flex items-center gap-2.5 border-b border-surface-2 px-[16px] py-[9px] last:border-b-0"
            >
              <span className="w-[18px] flex-none text-right font-mono text-[12px] font-bold text-ink-2">{i + 1}</span>
              <span className="h-[14px] w-[4px] flex-none [transform:skewX(-14deg)]" style={{ backgroundColor: colorFor(e.classId) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[13px] font-bold uppercase tracking-[0.02em] text-ink">
                  {e.displayName ?? `#${e.entityId}`}
                </span>
                {bar != null && (
                  <span className="mt-1 block h-[4px] w-full overflow-hidden rounded-[2px] bg-surface-2">
                    <span
                      className="block h-full"
                      style={{ width: `${Math.min(100, bar)}%`, backgroundColor: colorFor(e.classId) }}
                    />
                  </span>
                )}
              </span>
              <span className="flex-none text-right">
                <span className="block font-mono text-[14px] font-bold leading-none text-ink">{primary}</span>
                {secondary && <span className="mt-[3px] block font-mono text-[9px] uppercase tracking-[0.08em] text-muted-2">{secondary}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
