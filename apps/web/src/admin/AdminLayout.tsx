import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth/AuthContext'
import { useApiHealth } from '../api/adminQueries'
import { useCountdown } from '../lib/useCountdown'
import { AdminProvider, useAdmin } from './AdminContext'

/**
 * The console chrome, sized for the range an operator actually works in.
 *
 * It used to be one flex row that needed ~1330px and simply overflowed below that: 58px of
 * horizontal page scroll on a 1280 laptop and 314px on a 1024 one, with the identity block — the
 * only place the console says *which account you are operating as*, one click from the governance
 * screens — falling off the right edge first. Two structural moves fix it, both borrowed from the
 * player shell rather than invented here:
 *
 *   • Below `xl` the three context selectors drop to their own scrollable row (GlobalNav's
 *     "second row below lg" idiom). They are global state every screen reads, so they can never be
 *     the thing that gets hidden.
 *   • Below `lg` the sidebar becomes a horizontal scrollable nav and `main` takes the full width,
 *     because a fixed 212px rail costs a tablet a fifth of its screen.
 *
 * The dense data screens (the Prices board, Entries) are still desktop surfaces; this makes the
 * shell around them stop breaking, which is a different and smaller claim.
 */

const consoleNav = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/catalog', label: 'Catalog' },
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/entries', label: 'Entries' },
  { to: '/admin/prices', label: 'Prices' },
  { to: '/admin/results', label: 'Results' },
  { to: '/admin/rulesets', label: 'Rulesets' },
  { to: '/admin/scoring', label: 'Scoring' },
]
const governanceNav = [
  { to: '/admin/registrations', label: 'Registrations' },
  { to: '/admin/users', label: 'Users & Data' },
]

/** Hides a scrollbar without hiding the overflow. Same incantation the player nav uses. */
const HIDE_SCROLLBAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/**
 * Makes a horizontal scroller's overflow *visible as overflow*, by fading whichever edge still has
 * content behind it. Hiding the scrollbar without this leaves a nav that looks like it ends at
 * "Registrations" — the last two destinations simply don't exist as far as the operator can tell.
 * Returns a mask to spend on the element; `none` when everything fits, so a row that doesn't scroll
 * isn't dimmed for no reason.
 */
function useEdgeFade(ref: React.RefObject<HTMLElement | null>) {
  const [mask, setMask] = useState('none')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      const left = el.scrollLeft > 1
      const right = el.scrollLeft < max - 1
      const stops = [
        left ? 'transparent 0, #000 24px' : '#000 0',
        right ? '#000 calc(100% - 24px), transparent 100%' : '#000 100%',
      ].join(', ')
      setMask(left || right ? `linear-gradient(to right, ${stops})` : 'none')
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [ref])

  return mask
}

/**
 * Centre the active link when the strip mounts or the route changes. A deep link to /admin/users
 * otherwise highlights a destination scrolled off the right edge, which reads as "nothing is
 * selected". Centring rather than `scrollIntoView`, for two reasons: `inline: 'nearest'` parks the
 * link flush against the edge where the fade mask dims it, and run from a layout effect it measured
 * a layout that hadn't settled and landed 15px short. The maths here is explicit and clamped, and a
 * second pass on the next frame catches the settled widths. Instant, never smooth — this is
 * orientation on arrival, not a transition to watch.
 */
function useScrollActiveIntoView(ref: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    const el = ref.current
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!el || !active) return
    const centre = () => {
      const er = el.getBoundingClientRect()
      const ar = active.getBoundingClientRect()
      const delta = ar.left - er.left - (er.width - ar.width) / 2
      el.scrollLeft = Math.max(0, Math.min(el.scrollLeft + delta, el.scrollWidth - el.clientWidth))
    }
    centre()
    const id = requestAnimationFrame(centre)
    return () => cancelAnimationFrame(id)
  }, [ref, pathname])
}

/**
 * A dark, broadcast-styled native select for the topbar championship/season/round context.
 *
 * `min-w-0` + a max width is what stops "08 · Motul SportsCar Endurance Grand Prix" from claiming
 * 309px of a 1024px bar; the native control ellipsises its own label once it is constrained. Height
 * is chosen by *pointer*, not viewport — a touch tablet at 1180px wide is still a touch tablet, and
 * a 28px control is not a target on one.
 */
function ContextSelect({
  label,
  value,
  onChange,
  options,
  variant,
}: {
  label: string
  value: number | undefined
  onChange: (id: number) => void
  options: { id: number; label: string }[]
  /** `inline` shares one bar with everything else and must yield space; `row` owns its line and
   *  scrolls instead. Shrinking in a scroller is the worst of both — it squeezed the Season control
   *  down to a bare chevron on a phone, a filter showing neither its value nor its purpose. */
  variant: 'inline' | 'row'
}) {
  const shrink = variant === 'inline' ? 'min-w-0 flex-1' : 'shrink-0'
  return (
    <label className={`flex items-center gap-2 ${variant === 'inline' ? 'min-w-0' : 'shrink-0'}`}>
      <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] uppercase text-muted">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-7 max-w-[240px] cursor-pointer rounded-[3px] border border-line-2 bg-surface-3 px-2 font-display text-[12px] font-semibold tracking-[0.04em] text-ink-2 hover:border-line-3 focus:border-brand focus:outline-none pointer-coarse:h-11 ${shrink}`}
      >
        {options.length === 0 && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The three selectors, rendered inline in the bar at `xl` and as their own row below it. */
function ContextSelectors({
  className,
  ref,
  style,
  variant,
}: {
  className?: string
  ref?: React.Ref<HTMLDivElement>
  style?: React.CSSProperties
  variant: 'inline' | 'row'
}) {
  const ctx = useAdmin()
  return (
    <div className={className} ref={ref} style={style}>
      <ContextSelect
        label="Champ"
        variant={variant}
        value={ctx.championshipId}
        onChange={ctx.setChampionshipId}
        options={ctx.championships.map((c) => ({ id: c.id, label: c.name }))}
      />
      <ContextSelect
        label="Season"
        variant={variant}
        value={ctx.seasonId}
        onChange={ctx.setSeasonId}
        options={ctx.seasons.map((s) => ({ id: s.id, label: String(s.year) }))}
      />
      <ContextSelect
        label="Round"
        variant={variant}
        value={ctx.roundId}
        onChange={ctx.setRoundId}
        options={ctx.rounds.map((r) => ({ id: r.id, label: `${String(r.sequence).padStart(2, '0')} · ${r.name}` }))}
      />
    </div>
  )
}

function AdminTopbar() {
  const { user, logout } = useAuth()
  const ctx = useAdmin()
  const lock = useCountdown(ctx.round?.qualiStart)
  const selectorRow = useRef<HTMLDivElement>(null)
  const selectorMask = useEdgeFade(selectorRow)

  const initials = (user?.name ?? user?.email ?? 'A')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="border-b-2 border-brand bg-black">
      <div className="flex h-14 items-center gap-5 px-4 sm:px-[26px]">
        {/* The wordmark is the way home. It was a `div` — so the console had no exit at all, on a
            surface where GDPR export and account deletion are two clicks away and the only way out
            was browser Back or editing the URL. */}
        <Link to="/" className="shrink-0 rounded-[3px]" aria-label="Endurance Fantasy — back to the site">
          <Logo />
        </Link>
        <span className="flex shrink-0 items-center gap-[5px] rounded-[3px] border border-brand/40 bg-brand/10 px-2 py-[3px]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"
              stroke="#ff5d5d"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display text-[11px] font-bold tracking-[0.1em] text-brand-3">ADMIN</span>
        </span>

        {/* Inline only where the bar can genuinely hold them; otherwise they get the row below. */}
        <ContextSelectors variant="inline" className="ml-2 hidden min-w-0 flex-1 items-center gap-4 xl:flex" />

        <div className="ml-auto flex shrink-0 items-center gap-4 sm:gap-5">
          <span className="hidden shrink-0 items-center gap-[6px] whitespace-nowrap sm:flex">
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted">Player Lock</span>
            {/* A passed lock is history, not an alarm. This was `danger`, which was invisible while
                danger and brand-3 shared a hex — now that danger is rose it read as a failure, and
                sat in the same colour as the "locked incomplete" postmortem two rows below. The
                window closing on schedule is the system working; only the countdown still running
                is worth a colour. */}
            <span className={`font-mono text-[12px] font-medium ${lock.locked ? 'text-muted' : 'text-warn'}`}>
              {lock.text}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-[10px]">
            {/* The avatar is the constant; the name beside it appears where there is room. Same rule
                the player nav follows, so the two shells shed detail in the same order. */}
            <div className="hidden text-right leading-tight lg:block">
              <div className="whitespace-nowrap font-sans text-[12px] font-semibold text-ink">
                {user?.name ?? 'Admin'}
              </div>
              <div className="whitespace-nowrap font-mono text-[9px] tracking-[0.08em] uppercase text-muted">
                League Operator
              </div>
            </div>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-[12px] font-bold text-ink-2"
              title={user?.name ?? 'Admin'}
            >
              {initials}
            </div>
          </div>
          {/* The other half of the exit. Ghost, not a button-shaped control: leaving is not one of
              the console's actions, it is the door.

              `aria-label` is not decoration here. The visible label abbreviates to "SIGN" below
              `sm`, and `display:none` text is excluded from the accessible name — so without this
              the control that ends your session announced itself as "Sign", which a screen-reader
              user could just as reasonably read as sign *in*. The label stays whole regardless of
              what the viewport shows. The pseudo-element gives the 12px text a 44px target without
              changing a pixel of how it looks. */}
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Sign out"
            className="relative shrink-0 cursor-pointer whitespace-nowrap font-display text-[12px] font-semibold uppercase tracking-[0.05em] text-muted transition-colors before:absolute before:left-1/2 before:top-1/2 before:h-11 before:min-w-11 before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:text-ink-2"
          >
            Sign<span className="hidden sm:inline"> out</span>
          </button>
        </div>
      </div>

      {/* Second row: the context the bar can't hold inline. Scrolls rather than wraps, so the bar
          keeps a predictable height instead of growing a line every time a circuit name is long. */}
      <ContextSelectors
        variant="row"
        ref={selectorRow}
        style={{ maskImage: selectorMask, WebkitMaskImage: selectorMask }}
        className={`flex items-center gap-4 overflow-x-auto border-t border-line/60 px-4 py-2 sm:px-[26px] xl:hidden ${HIDE_SCROLLBAR}`}
      />
    </header>
  )
}

/** Vertical rail (lg+): the skewed brand bar marks the active link. */
function railClass({ isActive }: { isActive: boolean }) {
  return [
    'relative flex h-9 items-center rounded-[4px] pl-4 pr-3 font-display text-[13px] font-semibold uppercase tracking-[0.04em] transition-colors pointer-coarse:h-11',
    isActive
      ? 'bg-surface-2 text-ink before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:[transform:translateY(-50%)_skewX(-14deg)] before:bg-brand'
      : 'text-muted hover:text-ink-2',
  ].join(' ')
}

/** Horizontal row (below lg): an underline marks the active link, present-but-transparent when idle
 *  so labels never shift — the player nav's rule, applied to the console's own nav. */
function stripClass({ isActive }: { isActive: boolean }) {
  return [
    'flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 font-display text-[13px] font-semibold uppercase tracking-[0.04em] transition-colors',
    isActive ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink-2',
  ].join(' ')
}

/**
 * The console's liveness readout. It reports exactly what it checked — `GET /health` answered —
 * and nothing more. It replaces a hardcoded green dot reading "all systems go", which taught the
 * operator that this console's status indicators are decorative. The dot never carries the state
 * alone; the label says it in words.
 */
function ApiStatus({ className = '' }: { className?: string }) {
  const { isPending, isError } = useApiHealth()
  const { dot, label, tone } = isPending
    ? { dot: 'bg-muted-2', label: 'API · checking…', tone: 'text-muted' }
    : isError
      ? { dot: 'bg-danger', label: 'API · unreachable', tone: 'text-danger' }
      : { dot: 'bg-success', label: 'API · reachable', tone: 'text-muted' }

  return (
    <div className={`flex items-center gap-2 ${className}`} role="status">
      <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className={`whitespace-nowrap font-mono text-[9px] tracking-[0.08em] uppercase ${tone}`}>{label}</span>
    </div>
  )
}

function AdminSidebar() {
  return (
    <aside className="hidden w-[212px] shrink-0 flex-col border-r border-line bg-surface-3 lg:flex">
      {/* The rail and the strip are the same landmark in two shapes, so they carry the same name:
          exactly one is ever in the accessibility tree (the other is `display:none`, which excludes
          it), and someone moving between a tablet and a desktop should hear the same nav either way. */}
      <nav aria-label="Console sections" className="flex flex-1 flex-col gap-[2px] px-3 py-5">
        <div className="px-1 pb-2 font-mono text-[9px] tracking-[0.16em] uppercase text-muted">Console</div>
        {consoleNav.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={railClass}>
            {l.label}
          </NavLink>
        ))}
        <div className="px-1 pb-2 pt-5 font-mono text-[9px] tracking-[0.16em] uppercase text-muted">Governance</div>
        {governanceNav.map((l) => (
          <NavLink key={l.to} to={l.to} className={railClass}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <ApiStatus className="border-t border-line px-4 py-3" />
    </aside>
  )
}

/**
 * Below `lg` the rail becomes a strip. The links scroll and the status pins to the right, outside
 * the scroller — an ambient indicator that has to be scrolled to is not an indicator.
 */
function AdminNavStrip() {
  const scroller = useRef<HTMLElement>(null)
  const mask = useEdgeFade(scroller)
  useScrollActiveIntoView(scroller)

  return (
    <div className="flex items-center border-b border-line bg-surface-3 pl-4 sm:pl-[26px] lg:hidden">
      <nav
        ref={scroller}
        aria-label="Console sections"
        className={`flex min-w-0 flex-1 items-center gap-5 overflow-x-auto ${HIDE_SCROLLBAR}`}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {consoleNav.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={stripClass}>
            {l.label}
          </NavLink>
        ))}
        {/* The Console/Governance split is a real IA boundary, so it survives the reflow as a rule
            rather than quietly disappearing with its headings. */}
        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line-2" />
        {governanceNav.map((l) => (
          <NavLink key={l.to} to={l.to} className={stripClass}>
            {l.label}
          </NavLink>
        ))}
        {/* Trailing gutter exactly one fade-width wide, so scrolling to the end leaves the last
            link fully lit instead of half-dissolved under the mask. */}
        <span aria-hidden="true" className="w-6 shrink-0" />
      </nav>
      <ApiStatus className="ml-4 hidden shrink-0 border-l border-line pl-4 pr-4 sm:flex sm:pr-[26px]" />
    </div>
  )
}

/** The admin console chrome: broadcast topbar + Console/Governance nav, with the routed page. */
export function AdminLayout() {
  return (
    <AdminProvider>
      <div className="flex min-h-screen flex-col bg-bg">
        <AdminTopbar />
        <AdminNavStrip />
        <div className="flex flex-1">
          <AdminSidebar />
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 sm:py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminProvider>
  )
}
