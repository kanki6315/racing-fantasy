import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** A single pill toggle — the shared building block for the standings filters. */
export function FilterTab({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title?: string
  children: ReactNode
}) {
  return (
    // Selection shifts border + fill + ink weight (the chip spec) and carries the nav's 2px brand
    // underline as an inset rule — three filter rows can be active at once, and three solid-red
    // pills would blow the whole screen's red budget on a state that is neither the primary action
    // nor the live one.
    //
    // Height keys off the *pointer*, not the viewport: a filter is a touch target before it is a
    // label, and `sm:h-9` tightened to 36px from 640px up — which includes every touch tablet. A
    // coarse pointer gets 44px at any width; a mouse gets 36px at any width.
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`h-9 shrink-0 whitespace-nowrap rounded-[3px] px-[14px] font-display text-[13px] font-semibold uppercase tracking-[0.04em] transition-colors cursor-pointer pointer-coarse:h-11 ${
        active
          ? 'border border-line-3 bg-surface-2 text-ink shadow-[inset_0_-2px_0_0_var(--color-brand)]'
          : 'border border-line-2 text-muted hover:text-ink-2'
      }`}
    >
      {children}
    </button>
  )
}

const FADE = 28 // px of edge fade — wide enough to read as "more this way", narrow enough to stay legible

/**
 * Mouse-only overflow control. Touch swipes and keyboard tabbing both reach the far end of a
 * scroller on their own; a mouse without a horizontal wheel has no discoverable way to get there,
 * and hiding a whole championship behind an undiscoverable gesture is hiding functionality.
 * `aria-hidden` + `tabIndex={-1}` because it duplicates what Tab already does — four extra stops in
 * front of every filter row would be a worse keyboard experience, not a better one.
 */
function ScrollNudge({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      onClick={onClick}
      className={`absolute inset-y-0 hidden w-7 cursor-pointer items-center justify-center text-muted transition-colors hover:text-ink pointer-fine:flex ${
        dir === 'left' ? 'left-0 justify-start' : 'right-0 justify-end'
      }`}
    >
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden>
        <path
          d={dir === 'left' ? 'M6 1 1 6l5 5' : 'M1 1l5 5-5 5'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="square"
        />
      </svg>
    </button>
  )
}

/**
 * One line of pills that scrolls sideways instead of wrapping.
 *
 * Six championship names and eleven event names wrapped to four stacked rows, which cost ~330px on
 * desktop and about 1000px — two and a half screens — on a phone, before a single standing. The
 * app already owns this idiom: GlobalNav drops its section links to a scrollable second row below
 * `lg` with the scrollbar hidden and every link `shrink-0`. Same trick, same reasons.
 *
 * Converting wrap → scroll adds two obligations the wrapped version never had:
 *   1. **The selection can be off-screen.** A `?round=` deep link, or simply picking a late round and
 *      coming back, would leave the active pill parked outside the visible strip with no cue at all.
 *      It gets scrolled into view whenever it changes.
 *   2. **The overflow has to be visible as overflow.** A hidden scrollbar plus a clean edge reads as
 *      "that's all of them". A mask fades whichever edge still has content behind it.
 */
function FilterScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 })
  }, [])

  // Re-measure on content and container changes; a season swap can change both at once.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of el.children) ro.observe(child)
    return () => ro.disconnect()
  }, [measure, children])

  // Keep the active pill in view. Pure `scrollLeft` arithmetic rather than `scrollIntoView`, which
  // would also scroll the page vertically to reach a filter row the user can already see.
  //
  // Guarded on the active *node*, not on render: `children` is a fresh array every render, so an
  // unguarded effect would re-centre the row on every parent update — including while the user is
  // mid-scroll, yanking the strip back under their finger. A re-render with an unchanged selection
  // returns the same node and does nothing; moving the selection returns a different one.
  const lastCentred = useRef<Element | null>(null)
  useEffect(() => {
    const el = ref.current
    const active = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !active || lastCentred.current === active) return
    lastCentred.current = active
    const a = active.getBoundingClientRect()
    const s = el.getBoundingClientRect()
    if (a.left < s.left + FADE) el.scrollLeft += a.left - s.left - FADE
    else if (a.right > s.right - FADE) el.scrollLeft += a.right - s.right + FADE
  }, [children])

  const mask =
    edges.left || edges.right
      ? `linear-gradient(to right, ${edges.left ? `transparent 0, #000 ${FADE}px` : '#000 0'}, ${
          edges.right ? `#000 calc(100% - ${FADE}px), transparent 100%` : '#000 100%'
        })`
      : undefined

  const nudge = (dir: 'left' | 'right') => {
    const el = ref.current
    if (el) el.scrollBy({ left: (dir === 'left' ? -1 : 1) * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      <div
        ref={ref}
        onScroll={measure}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
        // Deliberately no `scroll-smooth` here. Positioning the row so a deep-linked round is
        // visible is initial state, not a transition — animating a 1400px slide on arrival is
        // gratuitous and delays the answer. The nudge buttons opt into smooth explicitly, because
        // there the motion is the feedback. It also keeps the arrival scroll working in renderers
        // that suppress smooth scrolling entirely.
        className="flex min-w-0 flex-1 gap-[6px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {edges.left && <ScrollNudge dir="left" onClick={() => nudge('left')} />}
      {edges.right && <ScrollNudge dir="right" onClick={() => nudge('right')} />}
    </div>
  )
}

/**
 * A labelled row of pills. The label sits outside the scroller so it stays put while the pills move
 * — a legend that scrolled away with its own content would be worse than no legend.
 */
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-[10px]">
      <span className="shrink-0 font-display text-[10px] tracking-[0.14em] uppercase text-muted">{label}</span>
      <FilterScroller>{children}</FilterScroller>
    </div>
  )
}

/**
 * The Total | per-round sub-filter, shared by season standings and league standings.
 * `value` is `'season'` (the season-wide pool) or a round id.
 */
export function RoundFilter({
  rounds,
  value,
  onChange,
}: {
  rounds: { id: number; name: string; sequence?: number }[]
  value: 'season' | number
  onChange: (v: 'season' | number) => void
}) {
  return (
    <div className="border-b border-line pb-[14px]">
      <FilterScroller>
        <FilterTab active={value === 'season'} onClick={() => onChange('season')}>
          Total
        </FilterTab>
        {rounds.map((r) => (
          // `R6 · <event>` rather than the bare event name. `sequence` is the round's real number in
          // the championship — these run 6–11, not 1–6, because the season's earlier rounds are
          // already behind us — so it restores the ordering the wrapped rows used to imply by
          // position, and gives a short scannable handle to aim for while scrolling. The full name
          // stays visible: these pills aren't truncated, the row just scrolls.
          <FilterTab key={r.id} active={value === r.id} onClick={() => onChange(r.id)} title={r.name}>
            {r.sequence != null ? `R${r.sequence} · ${r.name}` : r.name}
          </FilterTab>
        ))}
      </FilterScroller>
    </div>
  )
}
