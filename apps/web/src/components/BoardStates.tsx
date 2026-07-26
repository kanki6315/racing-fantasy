/*
 * Loading and failure states shared by every board-shaped surface (Landing, Standings, Stats,
 * LeagueStandings).
 *
 * They used to live in the LeagueStandings *route*. Three other routes imported them from there, so
 * a static import of that route sat in the entry chunk and its dynamic import could never split out
 * — the bundler said as much (INEFFECTIVE_DYNAMIC_IMPORT). Shared UI belongs beside the other shared
 * components, not inside whichever route happened to need it first.
 */

/**
 * Placeholder shaped like the table it stands in for.
 *
 * It used to be six 46px bars with no header band, so the real board's `surface-3` header and its
 * 51px rows pushed everything down the moment data landed — the layout shift was the loading state's
 * parting gift. Matching the header height and the row height keeps the top of the table still.
 * `aria-hidden` because it is pulse bars with no text; the live region already says "Loading
 * standings…".
 */
export function SkeletonTable() {
  return (
    <div aria-hidden className="overflow-hidden rounded-[4px] border border-line bg-surface">
      <div className="h-[38px] border-b border-line bg-surface-3" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[51px] animate-pulse border-b border-line bg-surface-2/40" />
      ))}
    </div>
  )
}

/**
 * A failed board with no way back. `onRetry` turns "Couldn't load these standings" from a dead end
 * into something a player can act on without reloading the page — a transient blip on a phone at a
 * circuit is the *typical* failure here, not the exotic one. The button is a ghost, not a second
 * danger-toned element: the box already carries the alarm, and two red things would compete.
 * It reports its own progress, because a retry that looks identical to not-retrying gets mashed.
 */
export function ErrorBox({
  message,
  onRetry,
  retrying = false,
}: {
  message: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div className="rounded-[4px] border border-danger/30 bg-danger/[0.06] px-5 py-8 text-center font-sans text-[13px] text-danger">
      {message}
      {onRetry && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="min-h-9 rounded-[3px] border border-line-2 px-4 py-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-2 transition-colors cursor-pointer hover:border-line-3 hover:text-ink disabled:cursor-default disabled:border-line disabled:text-muted pointer-coarse:min-h-11"
          >
            {retrying ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      )}
    </div>
  )
}
