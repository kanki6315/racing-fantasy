import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LeaderboardEntry } from '../api/queries'
import { BOARD_COLS, boardColsKey, tiedRanks } from '../lib/standings'

/**
 * Podium emphasis: the leader carries the one red, then the ink ramp dims down the order.
 *
 * Three tiers, and now actually three — ranks 3 and 4+ both returned `ink-2`, so a function shaped
 * like a podium rendered two steps. The podium is the top three, so the top three share `ink`.
 */
function rankColor(rank: number): string {
  if (rank === 1) return 'text-brand-2'
  if (rank <= 3) return 'text-ink'
  return 'text-ink-2'
}

/**
 * Round-over-round rank change on cumulative boards. `null` (single-round board, or a team's first
 * scored round) renders nothing; `0` holds; ±n climbs/drops. Positive = moved up the table.
 * Exported so the position bug can speak the exact same delta vocabulary as the row it points at.
 */
export function Movement({ value }: { value?: number | null }) {
  if (value == null) return null
  const label = value > 0 ? `up ${value}` : value < 0 ? `down ${-value}` : 'no change'
  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted'
  return (
    <span aria-label={`Moved ${label} since last round`} className={`font-mono text-[10px] leading-none ${tone}`}>
      {value > 0 ? `▲${value}` : value < 0 ? `▼${-value}` : '—'}
    </span>
  )
}

/**
 * The "you" row treatment, shared by the desktop grid and the mobile card list.
 *
 * The 7% wash this replaces measured 1.02:1 against the surface — invisible in practice, which left
 * the row you'd just scrolled 40 rows to find looking like every other row. This pairs the two
 * tinted-wash forms the One Red Rule explicitly sanctions (a `brand/14` fill and a full `brand/40`
 * hairline, drawn as an inset ring so the row doesn't shift by a pixel) with the solid slash and YOU
 * chip already on the row. Still no solid-red *fill*, so the page's red budget is untouched.
 *
 * `inset-ring-brand/40` rather than a hand-mixed `rgba(225,6,0,0.4)`: the literal was a second copy
 * of `--color-brand` that would have kept the old red through any future token change.
 *
 * `focus:` rather than `:focus-visible:` is deliberate — {@link YourPosition} moves focus here
 * programmatically after a mouse click, which never matches `:focus-visible`, and the arrival has to
 * be visible. It doubles as the reduced-motion alternative to the flash.
 */
const MINE_ROW =
  'bg-brand/[0.14] inset-ring-1 inset-ring-brand/40 focus:outline-2 focus:outline-offset-[-2px] focus:outline-brand-3'

/** Marks the viewer's row for the position bug to find, scroll to, and focus. */
const MINE_PROPS = { 'data-my-row': '', tabIndex: -1 } as const

/** `10` normally, `T10` in a tie. `aria-label` spells it out — "T10" reads as "tee ten" otherwise. */
export function Rank({ rank, tied, className }: { rank: number; tied: boolean; className?: string }) {
  return (
    <span className={className} aria-label={tied ? `Tied, position ${rank}` : undefined}>
      {tied ? `T${rank}` : rank}
    </span>
  )
}

/**
 * Shared standings table for every leaderboard surface (season, round, league, global).
 * `myRegistrationId` highlights the viewer's row; `showName` reveals the real name column
 * (members-only private leagues — the API only returns `name` when allowed).
 */
export function Leaderboard({
  entries,
  myRegistrationId,
  showName = false,
  emptyMessage = 'No standings yet — rows appear once a round is scored.',
  emptyAction,
  rowHref,
  caption = 'Standings',
  action = 'View picks',
}: {
  entries: LeaderboardEntry[]
  myRegistrationId?: number
  showName?: boolean
  emptyMessage?: string
  /** A way out of a dead end — an empty board explains itself but leaves nowhere to go. */
  emptyAction?: ReactNode
  /** When set, each row links to this URL — used to drill into a player's picks for a scored round. */
  rowHref?: (entry: LeaderboardEntry) => string
  /** Names the table for assistive tech — "a table" is not a useful thing to land on. */
  caption?: string
  /** The destination every linked row states, verb-first. Only rendered when `rowHref` is set. */
  action?: string
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[4px] border border-dashed border-line-2 px-5 py-12 text-center font-sans text-[13px] text-muted">
        <p>{emptyMessage}</p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    )
  }

  // Integer points render without the ".0" — but if ANY row is fractional, every row keeps one
  // decimal so the column still aligns to the digit (The Tabular-Numeral Rule).
  const showDecimals = entries.some((e) => !Number.isInteger(e.points))
  const fmtPoints = (p: number) => (showDecimals ? p.toFixed(1) : p.toLocaleString())
  const tied = tiedRanks(entries)

  // The last column is Rounds *or* the destination, never both — and the two never want the same
  // board. Rounds earns its place on a season total, where teams have played different numbers of
  // them; on a per-round board it prints "1" on every single row, which is exactly the board whose
  // rows link somewhere. So the dead column becomes the label, and no width is added to say it.
  const linked = rowHref != null
  const cols = BOARD_COLS[boardColsKey(showName, linked)]

  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
      {/*
       * sm+ : the full grid table.
       *
       * ARIA table roles rather than bare divs. Without them the header band was four unassociated
       * spans and a row announced as one run-on string — "1TG-Racing1,7951" — with the last two
       * numbers arriving with no idea which was points and which was rounds. The roles ride on top of
       * the CSS grid without changing a pixel of it.
       */}
      <div className="hidden sm:block" role="table" aria-label={caption}>
        <div role="rowgroup">
          <div
            role="row"
            className={`grid ${cols} items-center border-b border-line bg-surface-3 px-[18px] py-[10px] font-display text-[11px] tracking-[0.1em] uppercase text-muted`}
          >
            <span role="columnheader">#</span>
            <span role="columnheader">Team</span>
            {showName && <span role="columnheader">Player</span>}
            <span role="columnheader" className="text-right">Points</span>
            {linked ? (
              <span role="columnheader" className="sr-only">Lineup</span>
            ) : (
              <span role="columnheader" className="text-right">Rounds</span>
            )}
          </div>
        </div>
        <div role="rowgroup">
          {entries.map((e) => {
            const mine = myRegistrationId != null && e.registrationId === myRegistrationId
            const href = rowHref?.(e)
            return (
              <div
                key={e.registrationId}
                role="row"
                {...(mine ? MINE_PROPS : {})}
                className={`group relative grid ${cols} items-center border-b border-line px-[18px] py-[13px] ${
                  mine ? MINE_ROW : ''
                } ${href ? `transition-colors ${mine ? 'hover:bg-brand/[0.2]' : 'hover:bg-surface-2'}` : ''}`}
              >
                <span role="cell" className="flex items-baseline gap-1.5">
                  <Rank rank={e.rank} tied={tied.has(e.rank)} className={`font-mono text-[16px] font-bold ${rankColor(e.rank)}`} />
                  <Movement value={e.movement} />
                </span>
                <span role="cell" className="flex items-center gap-2 truncate font-display text-[15px] font-bold uppercase tracking-[0.02em] text-ink">
                  <span className={`h-[15px] w-[4px] flex-none [transform:skewX(-14deg)] ${mine ? 'bg-brand' : 'bg-line-3'}`} />
                  <TeamName entry={e} href={href} />
                  {mine && <span className="flex-none rounded-[2px] bg-brand px-[6px] py-[1px] font-mono text-[10px] tracking-[0.08em] text-ink">YOU</span>}
                </span>
                {showName && (
                  <span role="cell" className="truncate font-sans text-[12px] text-muted" title={e.name ?? undefined}>
                    {e.name ?? '—'}
                  </span>
                )}
                <span role="cell" className="text-right font-mono text-[15px] font-semibold text-ink">{fmtPoints(e.points)}</span>
                <span role="cell" className="text-right">
                  {linked ? (
                    <ActionLabel action={action} />
                  ) : (
                    <span className="font-mono text-[12px] text-muted">{e.roundsScored}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/*
       * < sm : each entry reflows into a card. A list, not a table — there are no aligned columns to
       * describe here, and every figure already carries its own inline label ("2 rounds", "pts"), so
       * claiming table structure would be describing a layout that isn't on screen.
       */}
      <ul role="list" className="sm:hidden">
        {entries.map((e) => {
          const mine = myRegistrationId != null && e.registrationId === myRegistrationId
          const href = rowHref?.(e)
          return (
            <li
              key={e.registrationId}
              {...(mine ? MINE_PROPS : {})}
              className={`group relative flex items-center gap-3 border-b border-line px-4 py-3 ${
                mine ? MINE_ROW : ''
              } ${href ? `transition-colors ${mine ? 'active:bg-brand/[0.2]' : 'active:bg-surface-2'}` : ''}`}
            >
              <span className="flex w-7 shrink-0 flex-col items-center gap-0.5">
                <Rank rank={e.rank} tied={tied.has(e.rank)} className={`font-mono text-[18px] font-bold leading-none ${rankColor(e.rank)}`} />
                <Movement value={e.movement} />
              </span>
              <div className="min-w-0 flex-1">
                {/* Type lives on the wrapper, matching the desktop cell, so the shared TeamName can
                    inherit it in both layouts instead of carrying two copies of the same styling. */}
                <div className="flex items-center gap-2 font-display text-[15px] font-bold uppercase tracking-[0.02em] text-ink">
                  <span className={`h-[14px] w-[4px] flex-none [transform:skewX(-14deg)] ${mine ? 'bg-brand' : 'bg-line-3'}`} />
                  <TeamName entry={e} href={href} />
                  {mine && <span className="flex-none rounded-[2px] bg-brand px-[6px] py-[1px] font-mono text-[10px] tracking-[0.08em] text-ink">YOU</span>}
                </div>
                <div className="mt-[3px] flex items-center gap-1.5 truncate font-mono text-[11px] text-muted">
                  {/* On a linked (per-round) card the rounds count is always "1 round" — the same dead
                      figure the desktop column drops — so the destination takes its place here too. */}
                  {linked ? (
                    <ActionLabel action={action} />
                  ) : (
                    <span>{e.roundsScored} {e.roundsScored === 1 ? 'round' : 'rounds'}</span>
                  )}
                  {showName && e.name && <span className="truncate text-muted">· {e.name}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[17px] font-bold leading-none text-ink">{fmtPoints(e.points)}</div>
                <div className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted">pts</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * The row's destination, stated. Matches the Landing calendar's row label exactly — same 10px tracked
 * caps, same `muted` at rest brightening to `ink-2` with the row — because they are the same idea on
 * two surfaces and a player should not have to learn it twice.
 *
 * Visible at rest, not on hover: a label that only appears under a cursor tells a touch user nothing,
 * and "is this row clickable" is precisely the question it exists to answer.
 */
function ActionLabel({ action }: { action: string }) {
  return (
    // `aria-hidden` because the row's link already carries the destination in its accessible name
    // ("Nuttytrain — view picks"). Announcing it twice per row, 45 rows deep, is noise, not help.
    <span
      aria-hidden
      className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.1em] text-muted transition-colors group-hover:text-ink-2"
    >
      {action} →
    </span>
  )
}

/**
 * A polite live region describing whatever board is currently on screen.
 *
 * Activating a filter silently replaced up to 65 rows: a screen-reader user pressed a pill and got
 * no confirmation anything had happened. It stays mounted across loading, error and loaded states —
 * a live region inserted at the same moment its text appears is unreliably announced — and
 * `aria-atomic` makes the whole sentence read rather than just the words that changed.
 */
export function BoardStatus({ text }: { text: string }) {
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </p>
  )
}

/**
 * The team name, and — on a board whose rows drill into a lineup — the row's link.
 *
 * The link lives *inside* the cell and stretches over the whole row with a pseudo-element, rather
 * than the row itself being an anchor. Making the row the link forced a choice between two broken
 * options: `role="row"` on an `<a>` destroys the link semantics, and leaving it a bare anchor gives
 * it the whole row's text as its name. This keeps the big pointer target, a clean accessible name,
 * and real table structure at the same time. The name states the destination, which is what the
 * rows have always owed a screen-reader user; the visible label is still pending.
 */
function TeamName({ entry, href }: { entry: LeaderboardEntry; href?: string }) {
  if (!href) {
    return (
      <span className="truncate" title={entry.teamName}>
        {entry.teamName}
      </span>
    )
  }
  return (
    <Link
      to={href}
      title={entry.teamName}
      aria-label={`${entry.teamName} — view picks`}
      className="truncate after:absolute after:inset-0 after:content-['']"
    >
      {entry.teamName}
    </Link>
  )
}
