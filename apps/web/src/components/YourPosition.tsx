import { useCallback, useEffect, useState } from 'react'
import type { LeaderboardEntry } from '../api/queries'
import { Movement, Rank } from './Leaderboard'
import { BOARD_COLS_SM, boardColsKey, tiedRanks } from '../lib/standings'
import { SM, useMediaQuery } from '../lib/useMediaQuery'
import { RegisterModal } from './RegisterModal'

/**
 * Height of the pinned bug. The row observer discounts it from the top of the viewport so a row
 * sitting *behind* the pinned bug never counts as visible — otherwise the bug would retire itself
 * the moment it covered the very row it points at, then reappear, then cover it again.
 */
const BUG_H = 52

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The viewer's row. Exactly one exists: the board renders the table *or* the card list, never both,
 * so this no longer has to sift a `display:none` copy out of two identically marked nodes.
 */
function myRow(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-my-row]')
}

function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/**
 * "Where do I place?" — answered without scrolling.
 *
 * Named for the broadcast bug it behaves like: it sits above the board at rest, pins to the top of
 * the viewport as you scroll, and **retires the moment your actual row is on screen**, because a
 * proxy for something you can already see is just clutter. An IntersectionObserver on the row drives
 * that; a 1px sentinel above the bug tells it whether it's currently pinned (retiring while it's
 * still in normal flow would leave a hole in the layout).
 *
 * Three shapes, and only the first one is sticky — a strip earns the right to follow you down the
 * page by having a position to track. The other two are notices; a permanently pinned notice is a nag.
 *  1. Registered, on this board → the bug: rank · team · points · movement, and a jump to the row.
 *  2. Registered, not on this board → why you're absent (sat the round out, season not scored yet).
 *  3. Signed in, not registered → the one action this page can offer that viewer.
 * Signed-out visitors and empty boards get nothing; a public leaderboard arriving from a shared link
 * should read as a leaderboard, not a login wall.
 */
export function YourPosition({
  entries,
  myRegistrationId,
  myTeamName,
  scope,
  registerSeasonId,
  showName = false,
  linked = false,
}: {
  entries: LeaderboardEntry[]
  /** Set when the viewer is signed in *and* registered for this board's season. */
  myRegistrationId?: number
  /** From the registration, so shape 2 can name the team even with no row on the board. */
  myTeamName?: string
  /** Only words the "no score" line — a season pool and a single round are absent for different reasons. */
  scope: 'season' | 'round'
  /** Set only when the viewer is signed in and *not* registered: the season to register for. */
  registerSeasonId?: number
  /** Mirrors the board's own prop — private-league tables add a Player column, and the bug rides the
   *  same grid, so it has to gain the column too or every figure to its right falls out of line. */
  showName?: boolean
  /** Also mirrors the board: linked rows widen the last track to fit their destination label. */
  linked?: boolean
}) {
  const myEntry = myRegistrationId != null ? entries.find((e) => e.registrationId === myRegistrationId) : undefined

  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null)
  const [pinned, setPinned] = useState(false)
  const [rowVisible, setRowVisible] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)

  const wide = useMediaQuery(SM)
  const myRank = myEntry?.rank

  useEffect(() => {
    if (!sentinel) return
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting))
    io.observe(sentinel)
    return () => io.disconnect()
  }, [sentinel])

  // The observer resolves the row itself rather than reading it from state. There is no second
  // consumer for the node — `jump` re-queries anyway, since a resize between render and click can
  // replace it — so holding it in state bought nothing but an extra render and a setState in an
  // effect whose only job was a DOM read. Re-runs when the board changes or the breakpoint flips the
  // layout; a fresh observer reports the new row's visibility on its first callback, so no stale
  // `true` survives a swap.
  useEffect(() => {
    if (myRank == null) return
    const el = myRow()
    if (!el) return
    const io = new IntersectionObserver(([e]) => setRowVisible(e.isIntersecting), {
      rootMargin: `-${BUG_H}px 0px 0px 0px`,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [myRank, entries, wide])

  const jump = useCallback(() => {
    const el = myRow()
    if (!el) return
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
    // Focus, not just scroll — otherwise a keyboard or screen-reader user gets a repainted viewport
    // and a caret still parked up in the filters. `preventScroll` keeps it from fighting the smooth
    // scroll above; the row's `focus:` outline is what marks the arrival once it lands.
    el.focus({ preventScroll: true })
    el.classList.remove('row-flash')
    void el.offsetWidth // restart the animation if a previous flash is still running
    el.classList.add('row-flash')
    el.addEventListener('animationend', () => el.classList.remove('row-flash'), { once: true })
  }, [])

  // ---- Shape 3: signed in, not registered ----
  //
  // Deliberately *before* the empty-board guard. This is the only shape that doesn't describe a row,
  // so it's the only one that still has something to say when the board is empty — and an empty board
  // is exactly where it's the sole useful thing on screen. It used to be suppressed there, which had
  // the value backwards.
  //
  // Demoted from a bordered panel with a 44px solid-red button to one quiet line. A signed-in viewer
  // browsing five series met five identical red CTAs; at 74px on desktop and ~250px on a phone it was
  // the loudest thing above a board they were trying to read, and the nav already carries a NOT
  // REGISTERED pill for the app-level version of the same message. Registering is not the primary
  // action of a board being read, so it doesn't get the page's one solid red — `brand-3` is the
  // tinted-red label the One Red Rule allows instead, and at 6.54:1 it still clears AA.
  //
  // No dismissal state: the demotion removes the reason for it, and hiding a line behind
  // remembered-elsewhere state trades a small repetition for a "where did that go?" problem.
  if (registerSeasonId != null) {
    return (
      <>
        {/*
         * Flex-wrap rather than an inline link inside the sentence: quiet must not cost the tap
         * target. Inline, the link measured 17px tall — well under the 44px minimum, which would have
         * traded a too-loud button for an unhittable one. Here it keeps its own box, sitting on the
         * sentence's line on a pointer and wrapping to its own 44px row on touch.
         */}
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-[2px] font-sans text-[12px] text-muted">
          <span>You're not registered for this season, so you won't appear on this board.</span>
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="inline-flex h-6 cursor-pointer items-center whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em] text-brand-3 transition-colors hover:text-brand-2 pointer-coarse:h-11"
          >
            Register →
          </button>
        </div>
        <RegisterModal seasonId={registerSeasonId} open={registerOpen} onOpenChange={setRegisterOpen} />
      </>
    )
  }

  if (entries.length === 0) return null
  if (myRegistrationId == null) return null

  // ---- Shape 2: registered, but nothing scored on this board ----
  if (!myEntry) {
    return (
      <div className="mb-4 flex items-center gap-[10px] rounded-[4px] border border-line-2 bg-surface px-4 py-[13px]">
        <span className="h-[18px] w-[4px] flex-none bg-brand [transform:skewX(-14deg)]" />
        <p className="min-w-0 font-sans text-[13px] text-ink-2">
          <span className="font-display font-bold uppercase tracking-[0.02em] text-ink">{myTeamName}</span>
          {scope === 'round' ? ' has no score in this round.' : ' has no scored rounds yet.'}
        </p>
      </div>
    )
  }

  // ---- Shape 1: the bug ----
  // Retire only while *pinned*: at rest the bug sits in normal flow, and fading it there would leave
  // a 52px hole above the board. Once pinned, its reserved slot is far above the viewport, so there
  // is nothing to collapse.
  const retired = pinned && rowVisible
  const points = Number.isInteger(myEntry.points) ? myEntry.points.toLocaleString() : myEntry.points.toFixed(1)
  // If your row is marked T25, the bug pointing at it says T25 too.
  const isTied = tiedRanks(entries).has(myEntry.rank)
  const move =
    myEntry.movement == null || myEntry.movement === 0
      ? ''
      : `, ${myEntry.movement > 0 ? 'up' : 'down'} ${Math.abs(myEntry.movement)} since last round`

  return (
    <>
      <div ref={setSentinel} aria-hidden className="h-px" />
      <div
        // `translate`, not `transform`: Tailwind v4 emits `-translate-y-1` as the standalone
        // `translate` property, so transitioning `transform` here leaves the movement snapping.
        className={`sticky top-0 z-30 mb-4 transition-[opacity,translate] duration-200 ease-out ${
          retired ? 'pointer-events-none -translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        {/*
         * The bug rides the leaderboard's own column grid (`64px 1fr 110px 90px`, 18px gutters) and
         * reuses the row's exact type sizes, so rank and points align to the digit with the table
         * underneath it — it reads as your row lifted out of the board rather than a separate widget.
         * The board's fourth column is Rounds, which the bug doesn't need, so the destination label
         * takes that slot. Below sm the board switches to cards, so the bug drops to auto columns too.
         */}
        <button
          type="button"
          onClick={jump}
          inert={retired || undefined}
          aria-label={`Jump to your row — ${isTied ? 'tied ' : ''}${ordinal(myEntry.rank)}, ${points} points${move}`}
          className={`grid h-[52px] w-full cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-[4px] border border-brand/40 bg-surface-2 px-4 text-left transition-shadow duration-200 sm:gap-0 sm:px-[18px] ${
            BOARD_COLS_SM[boardColsKey(showName, linked)]
          } ${pinned ? 'shadow-[0_8px_24px_rgba(0,0,0,0.5)]' : ''}`}
        >
          <span className="flex items-baseline gap-1.5">
            <Rank rank={myEntry.rank} tied={isTied} className="font-mono text-[16px] font-bold text-ink" />
            <Movement value={myEntry.movement} />
          </span>
          <span className="flex min-w-0 items-center gap-2 font-display text-[15px] font-bold uppercase tracking-[0.02em] text-ink">
            <span className="h-[15px] w-[4px] flex-none bg-brand [transform:skewX(-14deg)]" />
            <span className="truncate">{myEntry.teamName}</span>
            <span className="flex-none rounded-[2px] bg-brand px-[6px] py-[1px] font-mono text-[10px] tracking-[0.08em] text-ink">
              YOU
            </span>
          </span>
          {/* Hidden below sm: the mobile card list has no Player column to stay aligned with. */}
          {showName && (
            <span className="hidden truncate font-sans text-[12px] text-muted sm:block">{myEntry.name ?? '—'}</span>
          )}
          <span className="text-right font-mono text-[15px] font-semibold text-ink">{points}</span>
          {/* The destination, stated — the same rule the rows follow. The Rounds column is 90px, which
              "JUMP TO ROW →" overruns and wraps in; "JUMP →" holds one line at every width. */}
          <span className="whitespace-nowrap text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            <span className="hidden sm:inline">Jump </span>→
          </span>
        </button>
      </div>
    </>
  )
}
