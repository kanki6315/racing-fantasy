import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from './AdminContext'
import { ErrorPanel } from './ui'
import {
  useAllCarEntries,
  useAllClasses,
  useAllRounds,
  useAllSeasons,
  useAllSessions,
  useEntryDrivers,
} from '../api/adminQueries'
import { pricesQuery } from '../api/queries'
import { useNow } from '../lib/useCountdown'
import { pricingProgress } from '../lib/pricing'
import { buildBoardRows, resolveAfterPrices, sortByUrgency, type BoardBlocker, type BoardRow } from '../lib/adminBoard'

/**
 * The question an operator's week actually starts with.
 *
 * The console below this band answers "how is this round". An operator running six championships
 * asks "which of my six needs me" first, and answering it used to cost six trips through the topbar
 * — which is why the console's Flexibility score sat unmoved across three reviews.
 *
 * It costs five shared requests, not six sets of them: every list endpoint returns unfiltered when
 * given no filter, so seasons, rounds, classes, entries and sessions arrive once and are filtered in
 * memory. Prices are the exception — per-round, no unfiltered form — so they are batched through
 * `useQueries` for exactly the rows that got far enough to need them.
 *
 * Resolution happens *here*, before sorting, and that ordering is the point. When each row resolved
 * its own prices, the sort ran on unresolved state and a championship displaying "ready" could be
 * ranked among the ones still needing work — the band's one promise, broken by where a hook lived.
 */

const LOCK_SOON_MS = 24 * 60 * 60 * 1000

function fmtLock(ms: number | null): { text: string; tone: string } {
  if (ms == null) return { text: '—', tone: 'text-muted' }
  if (ms < 0) return { text: 'locked', tone: 'text-muted' }
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return {
    text: d > 0 ? `locks ${d}d ${h}h` : `locks ${h}h ${m % 60}m`,
    tone: ms < LOCK_SOON_MS ? 'text-warn' : 'text-muted',
  }
}

/** Where a blocker sends you, what the screen is called, and what it is. */
function blockerMeta(b: BoardBlocker): { label: string; to: string | null; dest: string; tone: string } {
  const catalog = (tab: string) => `/admin/catalog?tab=${tab}`
  switch (b.kind) {
    case 'no-season':
      return { label: 'no season set up', to: catalog('championships'), dest: 'Catalog', tone: 'text-ink-2' }
    case 'no-round':
      return { label: 'no rounds scheduled', to: catalog('rounds'), dest: 'Catalog', tone: 'text-ink-2' }
    case 'catalog':
      return { label: 'no classes set', to: catalog('classes'), dest: 'Catalog', tone: 'text-ink-2' }
    case 'entries':
      return { label: 'no entry list', to: '/admin/entries', dest: 'Entries', tone: 'text-ink-2' }
    case 'sessions':
      return { label: 'no sessions scheduled', to: catalog('sessions'), dest: 'Catalog', tone: 'text-ink-2' }
    case 'ready':
      return { label: 'ready', to: null, dest: 'Overview', tone: 'text-success' }
    case 'needs-prices':
      return { label: 'prices', to: '/admin/prices', dest: 'Prices', tone: 'text-ink-2' }
  }
}

const GRID =
  'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-x-4 gap-y-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_104px]'

/** A row with its prices already resolved — presentational, so it holds no queries of its own. */
type ResolvedRow = BoardRow & { status: string; resolving: boolean }

function BandRow({ row }: { row: ResolvedRow }) {
  const navigate = useNavigate()
  const { setChampionshipId } = useAdmin()
  const meta = blockerMeta(row.blocker)
  const lock = fmtLock(row.msToLock)
  const isReady = row.blocker.kind === 'ready'
  const roundText = row.round
    ? `RD ${String(row.round.sequence).padStart(2, '0')} · ${row.round.circuit ?? row.round.name}`
    : 'no round'

  // A button's accessible name is its children concatenated — which for four unlabelled spans came
  // out as "Road Americano classes set". The same defect DESIGN.md documents for leaderboard rows,
  // and the same fix: state it explicitly, with separators, and name the destination while we're
  // here so the row says where it goes.
  const label = `${row.championshipName} — ${roundText}, ${row.status}, ${lock.text}.${
    row.resolving ? '' : ` Opens ${meta.dest}.`
  }`

  const go = () => {
    setChampionshipId(row.championshipId)
    navigate(meta.to ?? '/admin')
  }

  return (
    <button
      type="button"
      onClick={go}
      aria-label={label}
      className={`${GRID} group w-full items-center border-b border-line px-4 py-[10px] text-left transition-colors last:border-b-0 hover:bg-surface-2 pointer-coarse:py-3`}
    >
      {/* Not uppercase. These are 33-character proper nouns, and DESIGN.md scopes the all-caps
          Title style to short labels — the same rule the context selectors were fixed for. */}
      <span
        className={`truncate font-display text-[13px] font-semibold tracking-[0.01em] ${
          isReady ? 'text-ink-2' : 'text-ink'
        }`}
      >
        {row.championshipName}
      </span>
      <span className="truncate font-mono text-[10px] tracking-[0.04em] text-muted">{roundText}</span>
      <span
        className={`truncate font-mono text-[10px] tracking-[0.04em] ${row.resolving ? 'text-muted' : meta.tone}`}
      >
        {row.status}
        {/* Visible at rest, so the row is legible as a door without hovering it. */}
        {!isReady && !row.resolving && (
          <span aria-hidden="true" className="text-muted transition-colors group-hover:text-ink-2">
            {' →'}
          </span>
        )}
      </span>
      <span
        className={`justify-self-start whitespace-nowrap font-mono text-[10px] tracking-[0.04em] lg:justify-self-end ${lock.tone}`}
      >
        {lock.text}
      </span>
    </button>
  )
}

function BandSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${GRID} items-center border-b border-line px-4 py-[10px] last:border-b-0`}>
          <span className="font-display text-[13px] font-semibold">
            <span className="inline-block h-[0.7em] w-32 rounded-[2px] bg-line-2 align-middle" />
            {'​'}
          </span>
          {/* Whole literal class strings, never `w-${n}`: Tailwind scans source text, so a
              template-composed utility generates no CSS and collapses the bar to zero width. */}
          {['w-24', 'w-20', 'w-16'].map((w) => (
            <span key={w} className="font-mono text-[10px]">
              <span className={`inline-block h-[0.7em] ${w} rounded-[2px] bg-line align-middle`} />
              {'​'}
            </span>
          ))}
        </div>
      ))}
    </>
  )
}

export function ChampionshipBand() {
  const { championships } = useAdmin()
  const seasons = useAllSeasons()
  const rounds = useAllRounds()
  const classes = useAllClasses()
  const cars = useAllCarEntries()
  const sessions = useAllSessions()
  // Minute resolution: this band ranks by urgency and prints hours, so a per-second tick would
  // re-render six rows sixty times to change nothing.
  const now = useNow(60_000)

  const base = buildBoardRows({
    championships: championships.map((c) => ({ id: c.id, name: c.name })),
    seasons: seasons.data ?? [],
    rounds: rounds.data ?? [],
    classes: classes.data ?? [],
    cars: cars.data ?? [],
    now,
  })

  // Only rows that cleared Catalog and Entries need prices; the rest never generate a request.
  const priceRounds = base.flatMap((r) => (r.blocker.kind === 'needs-prices' ? [r.blocker.roundId] : []))
  const priceResults = useQueries({ queries: priceRounds.map((id) => pricesQuery(id)) })
  const lineups = useEntryDrivers(undefined, { enabled: priceRounds.length > 0 })

  const shared = [seasons, rounds, classes, cars, sessions]
  const failedShared = shared.filter((q) => q.isError)
  // Gated on *success*, not on the absence of an error. Keying off `isFetching` left a hole exactly
  // the width of React Query's retry backoff: mid-retry a query is neither fetching nor errored, so
  // the band fell through and rendered six rows of "no season set up" — every championship declared
  // empty because its data hadn't arrived. Replacing a band that silently vanishes with one that
  // confidently lies is not a fix. Nothing renders from this data until all of it is actually here.
  const allLoaded = shared.every((q) => q.isSuccess)

  const resolved: ResolvedRow[] = base.map((row) => {
    const needs = row.blocker.kind === 'needs-prices' ? row.blocker : null
    if (!needs) {
      return { ...row, status: blockerMeta(row.blocker).label, resolving: false }
    }
    const idx = priceRounds.indexOf(needs.roundId)
    const q = priceResults[idx]
    if (!q || (!q.isSuccess && !q.isError)) {
      return { ...row, status: 'checking…', resolving: true }
    }
    const progress = pricingProgress(
      (cars.data ?? []).filter((c) => c.seasonId === row.seasonId),
      lineups.data ?? [],
      q.data ?? [],
      needs.roundId,
    )
    const sessionCount = (sessions.data ?? []).filter((s) => s.roundId === needs.roundId).length
    const blocker = resolveAfterPrices(row, progress.priced, progress.total, sessionCount)
    const noun = progress.mode === 'Car' ? 'cars' : 'drivers'
    const status =
      blocker.kind === 'needs-prices'
        ? `${progress.priced}/${progress.total} ${noun} priced`
        : blockerMeta(blocker).label
    return { ...row, blocker, status, resolving: false }
  })

  // Sorted *after* resolution, so a championship reading "ready" can never rank among the ones
  // still needing work.
  const rows = sortByUrgency(resolved) as ResolvedRow[]

  // One championship is not a board. The band exists to compare, so it hides rather than render a
  // single row restating the topbar.
  if (championships.length < 2) return null

  return (
    <section aria-labelledby="board-heading" className="settle-in">
      <h2 id="board-heading" className="mb-[10px] font-mono text-[10px] tracking-[0.14em] uppercase text-muted">
        Across your championships
      </h2>
      {failedShared.length > 0 ? (
        // Never `return null`. A band that silently isn't there is the same failure this console was
        // rebuilt to stop making: showing nothing rather than saying it couldn't ask.
        <ErrorPanel
          message="Couldn't load the championship board. The round below is unaffected."
          onRetry={() => failedShared.forEach((q) => void q.refetch())}
        />
      ) : (
        <div className="overflow-hidden rounded-[6px] border border-line bg-surface">
          {allLoaded ? (
            rows.map((r) => <BandRow key={r.championshipId} row={r} />)
          ) : (
            <BandSkeleton count={championships.length} />
          )}
        </div>
      )}
    </section>
  )
}
