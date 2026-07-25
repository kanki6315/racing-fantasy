import { useMemo, useState, type ReactNode } from 'react'
import {
  useChampionships,
  usePlayerPicks,
  useRosterRules,
  useRoundStats,
  useRounds,
  useSeasons,
} from '../api/queries'
import { useAuth } from '../auth/AuthContext'
import { BoardStatus } from '../components/Leaderboard'
import { FilterRow, FilterTab } from '../components/StandingsFilters'
import { StatsBoard, StatsBoardSkeleton } from '../components/StatsBoard'
import { classMeta } from '../lib/classMeta'
import { buildRows, entityKey, sortRows, type Sort, type SortKey } from '../lib/roundStats'
import { useNow } from '../lib/useCountdown'
import { ErrorBox } from './LeagueStandings'

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
  const { user } = useAuth()
  const champs$ = useChampionships()
  const champs = useMemo(() => champs$.data ?? [], [champs$.data])

  // Each selector holds only what the *user* picked, and the effective value is derived: the pick
  // when it still exists in the loaded list, otherwise the default. The four heal-in-an-effect
  // versions this replaces each cost a second render pass, and the champion one had a real symptom —
  // `champs` is `[]` while the request is in flight, so "no championships found" rendered as a red
  // error box for the length of the fetch, then vanished.
  const [champPick, setChampPick] = useState<number | null>(null)
  const champId = champs.some((c) => c.id === champPick) ? champPick : (champs[0]?.id ?? null)

  const seasons$ = useSeasons(champId ?? undefined)
  const seasons = useMemo(() => seasons$.data ?? [], [seasons$.data])
  const sortedSeasons = useMemo(() => [...seasons].sort((a, b) => b.year - a.year), [seasons])
  const [seasonPick, setSeasonPick] = useState<number | null>(null)
  const seasonId = seasons.some((s) => s.id === seasonPick) ? seasonPick : (sortedSeasons[0]?.id ?? null)

  const rounds$ = useRounds(seasonId ?? undefined)
  const roundList = useMemo(
    () => [...(rounds$.data ?? [])].sort((a, b) => a.sequence - b.sequence),
    [rounds$.data],
  )
  // One clock for the page, stepped once a minute: it decides the default round and which chips wear
  // a padlock, and holding it in state means a lock that lifts while the page is open flips both on
  // its own instead of going stale until a reload.
  const now = useNow(60_000)

  // Default to the latest *locked* round — the newest one whose stats actually exist.
  const defaultRoundId = useMemo(() => {
    if (roundList.length === 0) return null
    const locked = roundList.filter((r) => new Date(r.qualiStart).getTime() <= now)
    return (locked.length ? locked : roundList).at(-1)!.id
  }, [roundList, now])
  const [roundPick, setRoundPick] = useState<number | null>(null)
  const roundId = roundList.some((r) => r.id === roundPick) ? roundPick : defaultRoundId

  const stats$ = useRoundStats(roundId ?? undefined)
  const rules = useRosterRules(roundId ?? 0)

  // The class filter is scoped to the round it was chosen on, so changing rounds resets it to "All"
  // without an effect — a class present in one round often isn't in the next.
  const [classSel, setClassSel] = useState<{ round: number | null; value: number | 'all' }>({
    round: null,
    value: 'all',
  })
  const classId = classSel.round === roundId ? classSel.value : 'all'
  const setClassId = (value: number | 'all') => setClassSel({ round: roundId, value })

  const colorFor = (cid: number) => {
    const c = rules.data?.classes.find((x) => x.classId === cid)
    return classMeta(c?.name, c?.color).hex
  }
  const labelFor = (cid: number) => {
    const c = rules.data?.classes.find((x) => x.classId === cid)
    return classMeta(c?.name, c?.color).label
  }

  const stats = stats$.data
  // Memoised because `?? []` is a fresh array every render, which would re-run the board's
  // build-and-sort over the whole field on renders that changed nothing.
  const entities = useMemo(() => stats?.entities ?? [], [stats])

  // Class chips: only classes that actually have picked entities this round.
  const classIds = useMemo(() => {
    const present = new Set(entities.map((e) => e.classId))
    const ordered = (rules.data?.classes ?? []).map((c) => c.classId).filter((id) => present.has(id))
    // Include any present class not in the rules list (defensive), keeping rules order first.
    return [...ordered, ...[...present].filter((id) => !ordered.includes(id))]
  }, [entities, rules.data])

  // The signed-in player's own picks for this round, so their rows can be marked and their score put
  // next to the field's. `usePlayerPicks` is the same endpoint the standings drill-in already uses;
  // it needs no API change, and it only resolves once the round is locked — which is exactly when
  // this page has anything to show. A player with no roster this round simply gets no marks.
  const myRegId = user?.registrations.find((r) => r.seasonId === seasonId)?.id
  const picks$ = usePlayerPicks(myRegId, roundId ?? undefined)
  const mine = useMemo(
    () => new Set((picks$.data?.main ?? []).map(entityKey)),
    [picks$.data],
  )
  // A registered player who skipped this round still gets a 200 back — an empty roster with a total
  // of 0 — so the presence of `data` is not the test. Without the length check their summary read
  // "0 pts · -1124 vs avg", which is a scoreline for a round they never entered.
  const myRound = picks$.data && picks$.data.main.length > 0 ? picks$.data : null

  // Scoring is all-or-nothing for a round, so one entity carrying points means the round is scored.
  const scored = entities.some((e) => e.points != null)

  const [sort, setSort] = useState<Sort>({ key: 'swing', dir: 'desc' })
  // Before scoring there is no swing to sort by; fall back to the one column that has values. Not
  // held in state — a round change would otherwise leave the previous round's sort key stranded on a
  // column of em-dashes.
  const activeSort: Sort = useMemo(
    () => (scored ? sort : { key: 'own', dir: sort.dir }),
    [scored, sort],
  )
  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))

  const rows = useMemo(() => {
    const inClass = entities.filter((e) => classId === 'all' || e.classId === classId)
    // Swing is computed over the *unfiltered* field so a class filter narrows what you see without
    // moving the baseline underneath it — a car's swing must not change when you click its own class.
    const all = buildRows(entities, mine)
    const keep = new Set(inClass.map(entityKey))
    return sortRows(all.filter((r) => keep.has(entityKey(r.e))), activeSort)
  }, [entities, classId, mine, activeSort])

  const champ = champs.find((c) => c.id === champId)
  const season$ = seasons.find((s) => s.id === seasonId)
  const round$ = roundList.find((r) => r.id === roundId)

  /*
   * The champs → seasons → rounds → stats chain is one wait from the player's point of view, so the
   * page reasons about it as one. Only the links actually enabled count — a disabled query sits at
   * `pending` forever and would otherwise pin the page to a skeleton.
   *
   * Three distinct conditions, and conflating any two of them produces a lie:
   *   - `pending` — no data and no error yet. That includes the gaps *between* retries, where
   *     `isLoading` drops to false while the query is still very much unresolved. Reading
   *     `isLoading` alone let the page fall through to "no series yet" in those gaps.
   *   - `paused` — React Query parks a fetch rather than running it when the browser reports itself
   *     offline. A paused query never errors and never resolves, so an offline player was shown
   *     "NO SERIES YET": the app stating that the championship does not exist because it couldn't
   *     reach the network. That is the worst thing an empty state can be — confidently wrong.
   *   - `failed` — a real error, and the only one of the three that earns red.
   */
  const chain: { status: string; fetchStatus: string; isError: boolean }[] = [champs$]
  if (champId != null) chain.push(seasons$)
  if (seasonId != null) chain.push(rounds$)
  if (roundId != null) chain.push(stats$)

  const failed = chain.some((q) => q.isError)
  const paused = chain.some((q) => q.fetchStatus === 'paused')
  const pending = chain.some((q) => q.status === 'pending')
  const retrying = chain.some((q) => q.fetchStatus === 'fetching')

  // Retries anything unresolved, not just the errored links — when the cause was a paused fetch
  // there is no error to find, and re-running only the errors would do nothing at all.
  const retry = () => {
    const stale = (q: { status: string; isError: boolean }) => q.isError || q.status === 'pending'
    if (stale(champs$)) void champs$.refetch()
    if (champId != null && stale(seasons$)) void seasons$.refetch()
    if (seasonId != null && stale(rounds$)) void rounds$.refetch()
    if (roundId != null && stale(stats$)) void stats$.refetch()
  }

  const boardStatus = failed
    ? "Couldn't load these stats"
    : paused
      ? "Offline — can't load these stats"
      : pending
        ? 'Loading stats'
        : stats == null
        ? `${round$?.name ?? 'This round'} — stats locked until qualifying`
        : `${round$?.name ?? 'Round'}: ${rows.length} ${rows.length === 1 ? 'entity' : 'entities'}` +
          `${classId === 'all' ? '' : ` in ${labelFor(classId)}`}` +
          `${scored ? `, sorted by ${activeSort.key === 'own' ? 'ownership' : activeSort.key === 'pts' ? 'points' : 'swing'}` : ', not yet scored'}`

  return (
    // 920, not 1080. The board's widest team name measures 341px, so a 550px entity column left
    // 421px of nothing between "#57 Winward Racing" and its ownership figure — half the table's
    // width separating a row's subject from its numbers. Narrowing the page closes that without
    // touching the type, and lands Stats in the same proportion as the 860px standings board, which
    // is the same kind of object one column narrower.
    <div className="mx-auto max-w-[920px] px-4 py-7 sm:px-[26px]">
      <div className="flex items-center gap-[13px]">
        <span className="h-[28px] w-[6px] flex-none bg-brand [transform:skewX(-14deg)]" />
        <div>
          <h1 className="font-display text-[30px] font-extrabold uppercase leading-none text-ink">Stats</h1>
          <div className="mt-[6px] font-sans text-[12px] text-muted">
            {champ ? `${champ.name}${season$ ? ` · ${season$.year}` : ''}${round$ ? ` · ${round$.name}` : ''}` : 'Per-round picks & scoring breakdowns'}
          </div>
        </div>
      </div>

      {/*
       * Championship → Year → Round selectors, closed with a hairline.
       *
       * The page ran header → filters → board on three identical 24px gaps, so nothing grouped:
       * every block was equally far from every other one and the eye had no reason to read the
       * three selector rows as one thing. Tight inside the group (10px between rows), a rule under
       * it, and a more generous gap to the board — the same border-closed filter block the
       * standings round filter already uses.
       */}
      <div className="mt-[22px] flex flex-col gap-[10px] border-b border-line pb-5">
        <FilterRow label="Series">
          {champs.map((c) => (
            <FilterTab key={c.id} active={c.id === champId} onClick={() => setChampPick(c.id)}>
              {c.name}
            </FilterTab>
          ))}
        </FilterRow>
        {sortedSeasons.length > 0 && (
          <FilterRow label="Year">
            {sortedSeasons.map((s) => (
              <FilterTab key={s.id} active={s.id === seasonId} onClick={() => setSeasonPick(s.id)}>
                {s.year}
              </FilterTab>
            ))}
          </FilterRow>
        )}
        {roundList.length > 0 && (
          <FilterRow label="Round">
            {roundList.map((r) => {
              const locked = new Date(r.qualiStart).getTime() > now
              const chipLabel = `R${String(r.sequence).padStart(2, '0')} · ${r.name}`
              return (
                // `R06 · <event>` — the same spelling the standings round filter and the Landing
                // calendar use. Three renderings of one round number across a product is the kind of
                // drift nobody notices until they compare two screens.
                //
                // Rounds whose stats don't exist yet say so *before* the click. Four of this series'
                // six rounds are in the future today, and every one of them was an identical-looking
                // chip that led to a locked panel. The padlock is decorative; the locked state
                // reaches assistive tech through the button's own `aria-label`, so it is never
                // carried by iconography alone.
                <FilterTab
                  key={r.id}
                  active={r.id === roundId}
                  onClick={() => setRoundPick(r.id)}
                  title={locked ? `${r.name} — locked until qualifying` : r.name}
                  label={locked ? `${chipLabel}, locked until qualifying` : undefined}
                >
                  <span className="flex items-center gap-[6px]">
                    {chipLabel}
                    {locked && <LockGlyph />}
                  </span>
                </FilterTab>
              )
            })}
          </FilterRow>
        )}
      </div>

      {/* Pressing a filter silently swaps up to 49 rows; without this a screen-reader user gets no
          confirmation anything happened. Mounted across every state, because a live region inserted
          at the same moment its text appears is unreliably announced. */}
      <BoardStatus text={boardStatus} />

      <div className="mt-7">
        {/*
         * Order matters here, and it is the fix for the page's worst state bug: loading is checked
         * before emptiness, so an in-flight request can no longer render as "nothing found".
         *
         * Red is now reserved for things that actually broke. A round nobody entered, a series with
         * no rounds yet, and a lock that hasn't lifted are all ordinary, expected conditions — they
         * get the neutral panel. Before, all three wore `danger` red on a red-tinted border, which
         * meant a genuine API failure and a quiet weekend were indistinguishable.
         */}
        {failed ? (
          <ErrorBox message="Couldn't load these stats." onRetry={retry} retrying={retrying} />
        ) : paused ? (
          // Not red: being offline isn't a fault in the app, and it's the player's to fix. Neutral
          // panel, plain cause, and the same retry so there's a way forward without a reload.
          <EmptyPanel
            title="You're offline"
            body="These stats need a connection. Reconnect and try again — nothing is lost."
            action={
              <RetryButton onClick={retry} retrying={retrying} />
            }
          />
        ) : pending ? (
          <StatsBoardSkeleton />
        ) : !champ ? (
          <EmptyPanel title="No series yet" body="Championships appear here once one is set up." />
        ) : roundId == null ? (
          <EmptyPanel title="No rounds yet" body={`${champ.name} has no rounds on the calendar for this season.`} />
        ) : stats == null ? (
          <LockedState qualiStart={round$?.qualiStart} />
        ) : stats.rosters === 0 || entities.length === 0 ? (
          <EmptyPanel
            title="No picks this round"
            body="Nobody entered a roster for this round, so there's nothing to break down."
          />
        ) : (
          <>
            {/* Your round (when signed in and you entered), then the field's context + bonus usage */}
            {myRound && (
              // `w-fit`: the panel hugs its scoreline instead of stretching the full 868px for
              // three short figures. A highlighted box that is mostly empty reads as weaker than
              // the plain text under it, which defeats the point of highlighting it.
              <div className="mb-[7px] flex w-fit flex-wrap items-center gap-x-5 gap-y-2 rounded-[4px] border border-success/30 bg-success/[0.07] px-[18px] py-[11px] font-mono text-[12px] text-muted">
                <span className="font-display text-[11px] tracking-[0.12em] uppercase text-ink-2">Your round</span>
                <Metric label="pts" value={fmtScore(myRound.total)} />
                {stats.avgScore != null && (
                  <span className={myRound.total >= stats.avgScore ? 'text-success' : 'text-muted'}>
                    {myRound.total >= stats.avgScore ? '+' : '−'}
                    {fmtScore(Math.abs(myRound.total - stats.avgScore))} vs avg
                  </span>
                )}
              </div>
            )}
            {/*
             * The field's context, deliberately unboxed.
             *
             * It used to be a second full-width panel identical in height, radius and type to the
             * "your round" strip above it — two twins where one is the player's own scoreline and
             * the other is background. Nothing is gained by putting a caption in a box; dropping
             * the border and fill leaves exactly one emphasised element in this block and lets the
             * teal strip actually read as emphasis.
             */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-[2px] font-mono text-[12px] text-muted">
              <Metric label="entered" value={`${stats.rosters}`} />
              {stats.highScore != null && <Metric label="high" value={fmtScore(stats.highScore)} />}
              {stats.avgScore != null && <Metric label="avg" value={fmtScore(stats.avgScore)} />}
              {/* Both figures get a word. This read "+324.2 Double Points Team · 68%" — a value and a
                  percentage with nothing saying what either one measured. */}
              {stats.modifiers.map((m) => (
                <span key={m.kind}>
                  <span className="uppercase tracking-[0.04em]">{prettyKind(m.kind)}</span>
                  {' · used by '}
                  <span className="text-ink-2">{m.usagePct.toFixed(0)}%</span>
                  {m.avgBonus != null && (
                    <>
                      {' · '}
                      <span className="text-ink-2">+{m.avgBonus.toFixed(0)}</span> avg
                    </>
                  )}
                </span>
              ))}
            </div>

            {/* Class filter. The round's two summary lines sit tight together above; the gap opens
                here because this is where the block turns from reporting into controls. */}
            <div className="mt-6">
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

            {/* The board — tight to the class chips that filter it. */}
            <div className="mt-[14px]">
              {!scored && (
                <p className="mb-3 font-sans text-[13px] text-muted">
                  Picks are in. Points and swing land once the round is scored.
                </p>
              )}
              <StatsBoard
                rows={rows}
                sort={activeSort}
                onSort={onSort}
                colorFor={colorFor}
                labelFor={labelFor}
                scored={scored}
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

/**
 * Round scores run into the thousands, so they carry a thousands separator and drop the ".0" that
 * `toFixed(1)` printed on every whole number. Locale-aware via `toLocaleString`, because 1,523 and
 * 1.523 are the same figure to different readers.
 */
function fmtScore(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: Number.isInteger(v) ? 0 : 1 })
}

/**
 * The neutral panel for every ordinary "there's nothing here" — no series, no rounds, no entries,
 * and the pre-qualifying lock. Deliberately *not* {@link ErrorBox}: red is for things that broke.
 */
function EmptyPanel({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-[4px] border border-dashed border-line-2 px-5 py-12 text-center">
      <div className="font-display text-[13px] uppercase tracking-[0.1em] text-muted">{title}</div>
      <p className="mx-auto mt-2 max-w-[52ch] font-sans text-[13px] text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Same control as {@link ErrorBox}'s, for the panels that aren't errors but still need a way out. */
function RetryButton({ onClick, retrying }: { onClick: () => void; retrying: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={retrying}
      className="h-9 rounded-[3px] border border-line-2 px-4 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-2 transition-colors cursor-pointer hover:border-line-3 hover:text-ink disabled:cursor-default disabled:border-line disabled:text-muted pointer-coarse:h-11"
    >
      {retrying ? 'Retrying…' : 'Try again'}
    </button>
  )
}

/** Small padlock for the round chips. Decorative — the chips carry the word too. */
function LockGlyph() {
  return (
    <svg width="9" height="11" viewBox="0 0 9 11" fill="none" aria-hidden className="flex-none opacity-80">
      <path d="M2 4.5V3a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="0.6" y="4.5" width="7.8" height="6" fill="currentColor" />
    </svg>
  )
}

/**
 * Pre-qualifying. The old copy explained *why* the breakdown is held back but never *when* it lifts
 * — on a product whose whole premise is a hard deadline, that was the one question it owed an
 * answer to. `qualiStart` was already in the component; it just wasn't being shown.
 */
function LockedState({ qualiStart }: { qualiStart?: string }) {
  const when = qualiStart ? new Date(qualiStart) : null
  const valid = when && !Number.isNaN(when.getTime())
  return (
    <div className="rounded-[4px] border border-dashed border-line-2 px-5 py-12 text-center">
      <div className="font-display text-[13px] uppercase tracking-[0.1em] text-muted">Stats Locked</div>
      <p className="mx-auto mt-2 max-w-[52ch] font-sans text-[13px] text-muted">
        Pick breakdowns unlock when qualifying begins — held back so lineups can't be copied early.
      </p>
      {valid && (
        // Rendered in the reader's own zone and locale: a race weekend has a global audience, and a
        // UTC timestamp is a puzzle, not an answer.
        <p className="mt-3 font-mono text-[12px] text-ink-2">
          Unlocks{' '}
          <time dateTime={qualiStart}>
            {when.toLocaleString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </time>
        </p>
      )}
    </div>
  )
}

