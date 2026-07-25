import { useCallback, useEffect, useState } from 'react'
import type { LeaderboardEntry } from '../api/queries'
import { Movement } from './Leaderboard'
import { RegisterModal } from './RegisterModal'

/**
 * Height of the pinned bug. The row observer discounts it from the top of the viewport so a row
 * sitting *behind* the pinned bug never counts as visible — otherwise the bug would retire itself
 * the moment it covered the very row it points at, then reappear, then cover it again.
 */
const BUG_H = 52

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The one *displayed* `[data-my-row]`. The board renders a desktop grid and a mobile card list at the
 * same time and hides one with `display:none`, so both carry the marker; `offsetParent` is null for
 * the hidden branch, which is what tells them apart.
 */
function visibleMyRow(): HTMLElement | null {
  for (const node of document.querySelectorAll<HTMLElement>('[data-my-row]')) {
    if (node.offsetParent !== null) return node
  }
  return null
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
}) {
  const myEntry = myRegistrationId != null ? entries.find((e) => e.registrationId === myRegistrationId) : undefined

  const [rowEl, setRowEl] = useState<HTMLElement | null>(null)
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null)
  const [pinned, setPinned] = useState(false)
  const [rowVisible, setRowVisible] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)

  // Re-resolve the row on every board change (the node is remounted) and when the sm breakpoint flips
  // the grid/card branches, which swaps which of the two marked nodes is the displayed one.
  const myRank = myEntry?.rank
  useEffect(() => {
    // Reading a node another component rendered is the DOM-synchronisation case effects exist for,
    // and it can only happen after commit.
    const resolve = () => setRowEl(myRank == null ? null : visibleMyRow())
    resolve()
    const mq = window.matchMedia('(min-width: 640px)')
    mq.addEventListener('change', resolve)
    return () => mq.removeEventListener('change', resolve)
  }, [myRank, entries])

  useEffect(() => {
    if (!sentinel) return
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting))
    io.observe(sentinel)
    return () => io.disconnect()
  }, [sentinel])

  // No reset when `rowEl` goes null — a stale `true` can't leak, because `retired` below requires a
  // live row, and a fresh observer reports the new row's state on its first callback anyway.
  useEffect(() => {
    if (!rowEl) return
    const io = new IntersectionObserver(([e]) => setRowVisible(e.isIntersecting), {
      rootMargin: `-${BUG_H}px 0px 0px 0px`,
    })
    io.observe(rowEl)
    return () => io.disconnect()
  }, [rowEl])

  const jump = useCallback(() => {
    // Re-resolve rather than trusting state: a resize between render and click can swap the branch.
    const el = visibleMyRow() ?? rowEl
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
  }, [rowEl])

  if (entries.length === 0) return null

  // ---- Shape 3: signed in, not registered ----
  if (registerSeasonId != null) {
    return (
      <>
        <div className="mb-4 flex flex-col gap-3 rounded-[4px] border border-line-2 bg-surface px-4 py-[14px] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-[10px]">
            {/* Neutral slash: the red one means "you, on this board", which isn't true yet. */}
            <span className="h-[18px] w-[4px] flex-none bg-line-3 [transform:skewX(-14deg)]" />
            <p className="font-sans text-[13px] text-ink-2">
              You're not registered for this season, so you won't appear on this board.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="h-11 shrink-0 cursor-pointer rounded-[3px] bg-brand px-5 font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-brand-2"
          >
            Register
          </button>
        </div>
        <RegisterModal seasonId={registerSeasonId} open={registerOpen} onOpenChange={setRegisterOpen} />
      </>
    )
  }

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
  const retired = pinned && rowEl != null && rowVisible
  const points = Number.isInteger(myEntry.points) ? myEntry.points.toLocaleString() : myEntry.points.toFixed(1)
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
          aria-label={`Jump to your row — ${ordinal(myEntry.rank)}, ${points} points${move}`}
          className={`grid h-[52px] w-full cursor-pointer items-center gap-3 rounded-[4px] border border-brand/40 bg-surface-2 px-4 text-left transition-shadow duration-200 sm:gap-0 sm:px-[18px] ${
            showName
              ? 'grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[64px_1fr_minmax(0,1fr)_110px_90px]'
              : 'grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[64px_1fr_110px_90px]'
          } ${pinned ? 'shadow-[0_8px_24px_rgba(0,0,0,0.5)]' : ''}`}
        >
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-[16px] font-bold text-ink">{myEntry.rank}</span>
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
