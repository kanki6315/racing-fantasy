import type { ReactNode } from 'react'
import { FilterTab } from './StandingsFilters'
import { fmtSwing, type BoardRow, type Sort, type SortKey } from '../lib/roundStats'
import { SM, useMediaQuery } from '../lib/useMediaQuery'

/**
 * The column tracks, spelled out as a whole literal string.
 *
 * Tailwind scans source text, so a template-built `grid-cols-[...${n}]` generates no CSS and fails
 * as a silent no-op — the same trap `lib/standings.ts` documents for the standings board.
 *
 * ENTITY takes the `1fr`, which is the fix for the old three-column layout's truncation: at the
 * 1080px page width the name track lands around 640px, and the longest name in the series
 * ("#3 Corvette Racing by Pratt Miller Motorsports") measures well inside it.
 */
const COLS = 'grid-cols-[40px_92px_1fr_78px_78px_96px]'

/** Teal, not brand red — see the YOU chip note below. Positive is the good direction. */
function swingTone(v: number | null): string {
  if (v == null) return 'text-muted'
  return v > 0 ? 'text-success' : v < 0 ? 'text-muted' : 'text-ink-2'
}

/**
 * The signed-in player's mark on a row they owned.
 *
 * Solid teal with dark ink rather than the standings board's solid *red* YOU chip, for two reasons
 * that only apply here. The Confirmed-Is-Teal Rule: a pick already in the lineup is a state the
 * player has achieved, not the thing still to do. And there are three or four of these on a board at
 * once (one per class) where a leaderboard has exactly one — four solid-red chips would spend the
 * screen's whole red budget on a state that is neither the primary action nor the live one.
 *
 * White-on-teal measures 1.9:1, so the fill takes dark ink. That inverted-fill form is already in
 * the system as the SCORED lifecycle pill.
 */
function YouChip() {
  return (
    <span className="flex-none rounded-[2px] bg-success px-[6px] py-[1px] font-mono text-[10px] tracking-[0.08em] text-bg">
      YOU
    </span>
  )
}

/** The class's colour and name together — colour alone can't carry class for a colour-blind player. */
function ClassMark({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-[7px]">
      <span
        className="h-[13px] w-[4px] flex-none [transform:skewX(-14deg)]"
        style={{ backgroundColor: color }}
      />
      <span className="truncate font-mono text-[10px] tracking-[0.06em] text-ink-2">{label}</span>
    </span>
  )
}

const SORT_LABEL: Record<SortKey, string> = { own: 'Own %', pts: 'Points', swing: 'Swing' }

/** `aria-sort` belongs on the header cell, and only on the one actually sorted. */
function ariaSort(sort: Sort, key: SortKey): 'ascending' | 'descending' | undefined {
  if (sort.key !== key) return undefined
  return sort.dir === 'asc' ? 'ascending' : 'descending'
}

function SortableHeader({
  col,
  sort,
  onSort,
  children,
}: {
  col: SortKey
  sort: Sort
  onSort: (k: SortKey) => void
  children: ReactNode
}) {
  const active = sort.key === col
  const next = active && sort.dir === 'desc' ? 'ascending' : 'descending'
  return (
    <span role="columnheader" aria-sort={ariaSort(sort, col)} className="text-right">
      <button
        type="button"
        onClick={() => onSort(col)}
        // The name states what pressing it does, not what it currently is — `aria-sort` on the cell
        // already carries the current state, and announcing both makes every header a riddle.
        aria-label={`Sort by ${SORT_LABEL[col]}, ${next}`}
        // `uppercase` is repeated here rather than inherited from the header row: Tailwind's
        // Preflight resets `text-transform: none` on `button`, so the three sortable headers rendered
        // sentence-case beside the three static ones.
        className={`inline-flex w-full cursor-pointer items-center justify-end gap-1 uppercase transition-colors ${
          active ? 'text-ink' : 'hover:text-ink-2'
        }`}
      >
        {children}
        <span aria-hidden className={active ? 'text-brand-3' : 'text-transparent'}>
          {active && sort.dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </span>
  )
}

/**
 * The loading shape of this page, rather than a generic one.
 *
 * The shared `SkeletonTable` draws a single six-row column, so the board arriving replaced it with a
 * context strip, a chip row and a full-width table — a visible jump on every round change. This
 * traces the real layout instead, and `animate-pulse` already respects `prefers-reduced-motion`
 * through the project's global reduce block.
 */
export function StatsBoardSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-[42px] animate-pulse rounded-[4px] border border-line bg-surface-3" />
      <div className="mt-4 flex gap-[6px]">
        {[68, 84, 96, 76].map((w) => (
          <div key={w} className="h-9 animate-pulse rounded-[3px] bg-surface-2" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-[4px] border border-line bg-surface">
        <div className="h-[38px] animate-pulse border-b border-line bg-surface-3" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[50px] animate-pulse border-b border-line bg-surface-2/40 last:border-b-0" />
        ))}
      </div>
    </div>
  )
}

/**
 * The round's picked entities as one sortable board.
 *
 * This replaces three co-equal top-10 panels (Most Picked / Top Scorers / Best Value). They were
 * three independent orderings of the same thirty-odd rows that never crossed ownership with points —
 * so the one question a fantasy player actually brings to this page, "where did I gain or lose ground
 * against the field", had no answer anywhere on it. SWING is that crossing, and sorting replaces the
 * three fixed orderings.
 */
export function StatsBoard({
  rows,
  sort,
  onSort,
  colorFor,
  labelFor,
  scored,
}: {
  rows: BoardRow[]
  sort: Sort
  onSort: (k: SortKey) => void
  colorFor: (classId: number) => string
  labelFor: (classId: number) => string
  /** False before the race is scored — PTS and SWING have nothing in them yet. */
  scored: boolean
}) {
  // One layout in the DOM, not both — the standings board measured 56% of its nodes sitting behind
  // `display:none` before it made the same change.
  const wide = useMediaQuery(SM)

  // If any figure in a column is fractional, every row in it keeps a decimal, so the column still
  // aligns to the digit (The Tabular-Numeral Rule).
  const ownDec = rows.some((r) => !Number.isInteger(r.e.pickPct))
  const ptsDec = rows.some((r) => r.e.points != null && !Number.isInteger(r.e.points))
  const fmtOwn = (v: number) => `${ownDec ? v.toFixed(1) : v}%`
  const fmtPts = (v: number | null) => (v == null ? '—' : ptsDec ? v.toFixed(1) : `${v}`)

  return (
    <div>
      {/* Below `sm` the column headers are far too small to be sort targets, so the sort moves out
          into the chip vocabulary the filters already use. */}
      {!wide && (
        <div role="group" aria-label="Sort board" className="mb-3 flex items-center gap-[10px]">
          <span className="shrink-0 font-display text-[10px] tracking-[0.14em] uppercase text-muted">Sort</span>
          <div className="flex gap-[6px]">
            {(['own', 'pts', 'swing'] as SortKey[]).map((k) => (
              <FilterTab key={k} active={sort.key === k} onClick={() => onSort(k)}>
                {SORT_LABEL[k]}
                {sort.key === k && <span aria-hidden> {sort.dir === 'asc' ? '▲' : '▼'}</span>}
              </FilterTab>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
        {wide ? (
          <div role="table" aria-label="Round picks and scoring">
            <div role="rowgroup">
              <div
                role="row"
                className={`grid ${COLS} items-center gap-x-3 border-b border-line bg-surface-3 px-[16px] py-[10px] font-display text-[11px] tracking-[0.1em] uppercase text-muted`}
              >
                <span role="columnheader">#</span>
                <span role="columnheader">Class</span>
                <span role="columnheader">Entity</span>
                <SortableHeader col="own" sort={sort} onSort={onSort}>Own %</SortableHeader>
                <SortableHeader col="pts" sort={sort} onSort={onSort}>Pts</SortableHeader>
                <SortableHeader col="swing" sort={sort} onSort={onSort}>Swing</SortableHeader>
              </div>
            </div>
            <div role="rowgroup">
              {rows.map((r, i) => (
                <div
                  key={`${r.e.entityType}-${r.e.entityId}`}
                  role="row"
                  className={`grid ${COLS} items-center gap-x-3 border-b border-line px-[16px] py-[11px] last:border-b-0 ${
                    r.mine ? 'bg-success/[0.12]' : ''
                  }`}
                >
                  <span role="cell" className="font-mono text-[13px] font-bold text-ink-2">{i + 1}</span>
                  <span role="cell" className="min-w-0">
                    <ClassMark color={colorFor(r.e.classId)} label={labelFor(r.e.classId)} />
                  </span>
                  <span role="cell" className="flex min-w-0 items-center gap-2">
                    <span
                      className="truncate font-display text-[14px] font-bold uppercase tracking-[0.02em] text-ink"
                      title={r.e.displayName ?? undefined}
                    >
                      {r.e.displayName ?? `#${r.e.entityId}`}
                    </span>
                    {r.mine && <YouChip />}
                  </span>
                  <span role="cell" className="text-right font-mono text-[13px] text-ink-2">{fmtOwn(r.e.pickPct)}</span>
                  <span role="cell" className="text-right font-mono text-[14px] font-semibold text-ink">{fmtPts(r.e.points)}</span>
                  <span role="cell" className={`text-right font-mono text-[14px] font-bold ${swingTone(r.swing)}`}>
                    {fmtSwing(r.swing)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // A list, not a table: there are no aligned columns on screen to describe, and every figure
          // carries its own inline label.
          <ul role="list">
            {rows.map((r, i) => (
              <li
                key={`${r.e.entityType}-${r.e.entityId}`}
                className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 ${
                  r.mine ? 'bg-success/[0.12]' : ''
                }`}
              >
                <span className="w-5 shrink-0 text-right font-mono text-[13px] font-bold text-ink-2">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ClassMark color={colorFor(r.e.classId)} label={labelFor(r.e.classId)} />
                    {r.mine && <YouChip />}
                  </div>
                  {/* Wraps rather than truncates. At 375px a 46-character uppercase team name has no
                      honest single-line form, and clipping the sponsor off the end of a car is how you
                      end up with two rows that read identically. */}
                  <div className="mt-[3px] font-display text-[14px] font-bold uppercase leading-[1.15] tracking-[0.02em] text-ink">
                    {r.e.displayName ?? `#${r.e.entityId}`}
                  </div>
                  <div className="mt-[3px] font-mono text-[11px] text-muted">
                    {fmtOwn(r.e.pickPct)} own{scored && <> · {fmtPts(r.e.points)} pts</>}
                  </div>
                </div>
                {scored && (
                  <div className="shrink-0 text-right">
                    <div className={`font-mono text-[16px] font-bold leading-none ${swingTone(r.swing)}`}>
                      {fmtSwing(r.swing)}
                    </div>
                    <div className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.1em] text-muted">swing</div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
       * The page's first piece of documentation. SWING is a derived number with no unit a player can
       * guess, and the old board shipped a bare "74.15" with nothing anywhere explaining it.
       *
       * "picked" is load-bearing and deliberate: the stats payload only carries entities somebody
       * actually picked, so this is the median of those, not of the full entry list. Saying "class
       * median" alone would imply a baseline the page can't compute.
       */}
      {scored && (
        <p className="mt-3 font-sans text-[12px] text-muted">
          <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-2">Swing</span> — points above
          or below the median picked entity in the same class.
        </p>
      )}
    </div>
  )
}
