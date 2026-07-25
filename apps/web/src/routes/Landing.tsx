import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Leaderboard } from '../components/Leaderboard'
import { RegisterModal } from '../components/RegisterModal'
import { ErrorBox, SkeletonTable } from './LeagueStandings'
import { useAuth } from '../auth/AuthContext'
import { useActiveSeason, useSeasonLeaderboard, useRounds, useEvents, useGlobalStats } from '../api/queries'
import { useCountdown } from '../lib/useCountdown'
import { deriveEventStatus, type EventStatus } from '../lib/eventStatus'

/** One weekend on the unified calendar (ADR-0007), driven by the Event API — every series racing it. */
type CalSeries = { name: string; order: number; isActive: boolean }
type CalItem = {
  key: string
  seq?: number // the active championship's round number this weekend, if it races (cosmetic label)
  title: string
  track: string
  dateMs: number
  series: CalSeries[]
  activeRoundId?: number // the active championship's round here, if any (links the hero to its weekend)
  picksOpen: boolean // admin-released the board for this weekend
  scored: boolean // manual admin flag → SCORED lifecycle state
  finalized: boolean // manual admin flag → CLOSED (collapsed to a single anchor on the calendar)
  earliestQuali: string // soonest quali across the weekend's series — the first round to lock
  latestQuali: string // last quali across the weekend's series
}

// The calendar keeps its bold, solid-fill "timing screen" pills, but the state now comes from the shared
// deriveEventStatus() lifecycle (single source of truth). Label + fill per EventStatus.
const statusStyle: Record<EventStatus, string> = {
  OPEN: 'text-ink bg-brand',
  WAITING: 'text-ink-2 bg-line',
  IN_PROGRESS: 'text-bg bg-warn',
  AWAITING: 'text-ink-2 bg-surface-2',
  SCORED: 'text-bg bg-ink', // checkered-flag white: results posted, distinct from FINAL's dim neutral
  CLOSED: 'text-muted bg-surface-2',
}
// "FINAL" (racing vocabulary: results official, weekend archived) — distinct from SCORED (points
// posted, go review). Mirrors EVENT_STATUS_META's label so the two pill vocabularies agree.
const statusLabel: Record<EventStatus, string> = {
  OPEN: 'PICKS OPEN',
  WAITING: 'COMING SOON',
  IN_PROGRESS: 'IN PROGRESS',
  AWAITING: 'AWAITING RESULTS',
  SCORED: 'SCORED',
  CLOSED: 'FINAL',
}

/** "Jun 28" from an ISO date. */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "SAT · JUL 30 · 11:05 AM" — the absolute wall-clock moment behind a countdown (viewer's timezone). */
function fmtLockTime(iso: string) {
  const d = new Date(iso)
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' })
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${wd} · ${md} · ${t}`.toUpperCase()
}

/**
 * Landing (public + logged-in variants). A full-width hero band (the next event, promoted from the
 * calendar: status pill, lock countdown + absolute time, primary CTA) over the unified event calendar
 * (rows start at the event after the hero's) and the global leaderboard. When a signed-in user isn't
 * registered for any season, the registration call-out + team-name modal appear and the hero CTA
 * demotes to secondary.
 */
export function Landing() {
  const { isAuthenticated, user, loginWithGoogle } = useAuth()
  const { data: active } = useActiveSeason()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)

  // Upcoming events — event-centric (ADR-0007). The unified weekend calendar: every event (with all
  // series racing it as pills) plus the active championship's standalone rounds. Includes weekends the
  // active championship sits out.
  const roundsQ = useRounds(active?.season.id)
  const eventsQ = useEvents()
  const activeRounds = useMemo(
    () => [...(roundsQ.data ?? [])].sort((a, b) => a.sequence - b.sequence),
    [roundsQ.data],
  )

  const now = Date.now()

  // The unified calendar is driven entirely by the Event API (every series' weekends), independent of
  // any single "active" championship. We scope to the latest year present so it reads as the current
  // season. The active championship is used only to (a) label its round number and (b) highlight its pill.
  const calendar = useMemo<CalItem[]>(() => {
    const events = eventsQ.data ?? []
    const latestYear = Math.max(0, ...events.flatMap((e) => e.rounds.map((r) => r.year)))
    if (!latestYear) return []
    const seqByRoundId = new Map(activeRounds.map((r) => [r.id, r.sequence]))
    const items: CalItem[] = []
    for (const e of events) {
      const evRounds = e.rounds.filter((r) => r.year === latestYear)
      if (evRounds.length === 0) continue
      const qualis = evRounds.map((r) => +new Date(r.qualiStart))
      const mine = active ? evRounds.find((r) => r.championshipId === active.championship.id) : undefined
      // Unique series racing this weekend, ordered by the championship sort key.
      const byName = new Map<string, number>()
      for (const r of evRounds) if (!byName.has(r.championshipName)) byName.set(r.championshipName, r.championshipOrder)
      const series = [...byName.entries()]
        .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
        .map(([name, order]) => ({ name, order, isActive: !!active && name === active.championship.name }))
      items.push({
        key: `e${e.id}`,
        seq: mine ? seqByRoundId.get(mine.roundId) : undefined,
        title: e.name,
        track: e.circuit ?? '',
        dateMs: e.startsAt ? +new Date(e.startsAt) : Math.min(...qualis),
        series,
        activeRoundId: mine?.roundId,
        picksOpen: e.picksOpen,
        scored: e.scored,
        finalized: e.finalized,
        earliestQuali: new Date(Math.min(...qualis)).toISOString(),
        latestQuali: new Date(Math.max(...qualis)).toISOString(),
      })
    }
    items.sort((a, b) => a.dateMs - b.dateMs)
    // Collapse the past: keep every non-finalized weekend, plus only the most-recent finalized one as a
    // historical anchor (a scored-but-not-finalized weekend is the natural second item). Flag-driven, so
    // no dependency on `now` — the per-row pill re-derives its live status separately.
    const lastFinalizedKey = [...items].reverse().find((i) => i.finalized)?.key ?? null
    return items.filter((i) => !i.finalized || i.key === lastFinalizedKey)
  }, [active, eventsQ.data, activeRounds])

  const calLoading = roundsQ.isLoading || eventsQ.isLoading
  const calError = roundsQ.isError || eventsQ.isError

  // Hero — the next event (soonest weekend not yet fully locked), seeded entirely from the Event API:
  // name, track, date, the series racing it, and a lock countdown (to the first series' quali while the
  // weekend is open, then to the last while it's closing).
  const nextEvent = calendar.find((c) => +new Date(c.latestQuali) > now)
  const heroOpen = nextEvent ? now < +new Date(nextEvent.earliestQuali) : false
  const heroCd = useCountdown(nextEvent ? (heroOpen ? nextEvent.earliestQuali : nextEvent.latestQuali) : undefined)
  const heroTitle = nextEvent?.title ?? (calendar.length ? 'Season complete' : 'Schedule coming soon')
  const heroWhere = nextEvent
    ? [nextEvent.track, fmtDate(new Date(nextEvent.dateMs).toISOString())].filter(Boolean).join(' · ')
    : ''
  const heroSeries = nextEvent?.series ?? []

  // "Registered" now means a registration in ANY series — a player interested only in a support series
  // shouldn't be nagged to enter the headline championship (future: per-series call-outs).
  const registration =
    active && user ? (user.registrations.find((r) => r.seasonId === active.season.id) ?? null) : null
  const hasAnyRegistration = (user?.registrations.length ?? 0) > 0
  const needsRegistration = isAuthenticated && !!active && !hasAnyRegistration

  const onHeroCta = () => {
    if (!isAuthenticated) loginWithGoogle()
    else if (needsRegistration) setModalOpen(true)
    // Straight to the lineup when the hero has an active-championship round — the CTA says
    // "Set Your Lineup", so land on it (the pick page handles not-open/locked states itself).
    else if (nextEvent?.activeRoundId) navigate(`/pick/${nextEvent.activeRoundId}`)
    else navigate('/dashboard')
  }

  // The hero band IS the calendar's top entry, promoted — so its status pill derives from the same
  // lifecycle as the rows, and the rows below start at the event after it (no duplication).
  const heroStatus = nextEvent
    ? deriveEventStatus(
        {
          picksOpen: nextEvent.picksOpen,
          scored: nextEvent.scored,
          finalized: nextEvent.finalized,
          rounds: [{ qualiStart: nextEvent.earliestQuali }, { qualiStart: nextEvent.latestQuali }],
        },
        now,
      )
    : null
  const heroLockIso = nextEvent ? (heroOpen ? nextEvent.earliestQuali : nextEvent.latestQuali) : null
  const upcomingRows = calendar.filter((c) => c.key !== nextEvent?.key)

  return (
    <>
      {/* registration call-out — signed in but not yet entered this season */}
      {needsRegistration && (
        <div className="relative flex items-center gap-[34px] overflow-hidden border-b border-[#2a0d0c] bg-[linear-gradient(110deg,#1a0604_0%,#120608_46%,#0a0b0d_100%)] px-4 py-7 sm:px-[30px] sm:py-[30px]">
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_22px,rgba(225,6,0,0.04)_22px_23px)]" />
          <div className="relative min-w-0 flex-1">
            {/* Tinted wash, not a solid fill: this view already spends red on the banner CTA (the
                primary action) and the hero's PICKS OPEN pill (the live state). A third solid red
                here — plus a red avatar in the nav — broke the One Red Rule. */}
            <div className="mb-[13px] inline-flex h-6 items-center gap-2 rounded-[2px] border border-brand/40 bg-brand/15 px-[11px]">
              <span className="h-[6px] w-[6px] rounded-full bg-brand-2" />
              <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-brand-3">
                {active.season.year} REGISTRATION OPEN
              </span>
            </div>
            <div className="font-display text-[26px] font-extrabold uppercase leading-[1.02] text-ink sm:text-[34px]">
              Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.<br />Claim your team for the {active.season.year} season.
            </div>
            <div className="mt-[11px] max-w-[560px] font-sans text-[14px] text-ink-2">
              You're signed in but haven't entered this year's championship yet. Pick a team name to start
              setting lineups, join leagues, and climb the global board.
            </div>
            <div className="mt-[18px] flex flex-wrap items-center gap-x-[18px] gap-y-2">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex h-12 items-center justify-center gap-[9px] rounded-[3px] bg-brand px-[26px] cursor-pointer hover:bg-brand-2 transition-colors"
              >
                <span className="font-display text-[17px] font-bold italic tracking-[0.05em] uppercase text-ink">
                  Register for {active.season.year}
                </span>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
              <span className="font-sans text-[13px] text-muted">Takes seconds · free to play</span>
            </div>
          </div>
        </div>
      )}

      {/* hero band — the next event as a broadcast lower-third: identity left, timing + action right.
          The band IS the calendar's top entry, promoted; the rows below start at the following event. */}
      <div className="bg-black">
        <div className="border-b border-line bg-gradient-to-b from-surface-3 to-bg">
          {calLoading ? (
            <div className="px-4 py-[26px] sm:px-[26px]" aria-hidden>
              <div className="h-[11px] w-[120px] animate-pulse rounded-[2px] bg-surface-2" />
              <div className="mt-[14px] h-[38px] max-w-[560px] animate-pulse rounded-[3px] bg-surface-2" />
              <div className="mt-[12px] h-[14px] w-[220px] animate-pulse rounded-[2px] bg-surface-2" />
            </div>
          ) : (
            <div className="flex flex-col gap-[26px] px-4 py-[26px] sm:px-[26px] lg:flex-row lg:items-center lg:gap-12">
              {/* identity */}
              <div className="min-w-0 flex-1">
                <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-muted">// NEXT_EVENT</span>
                  {nextEvent?.seq != null && (
                    <span className="font-mono text-[13px] font-bold leading-none text-ink">
                      R{String(nextEvent.seq).padStart(2, '0')}
                    </span>
                  )}
                  {heroStatus && (
                    <span className={`inline-block rounded-[2px] px-[9px] py-[3px] font-display text-[11px] tracking-[0.06em] ${statusStyle[heroStatus]}`}>
                      {statusLabel[heroStatus]}
                    </span>
                  )}
                </div>
                <h1 className="font-display text-[34px] font-extrabold uppercase leading-[0.98] text-ink [text-wrap:balance] sm:text-[40px]">
                  {heroTitle}
                </h1>
                {heroWhere && <div className="mt-[10px] font-sans text-[14px] text-muted">{heroWhere}</div>}
                {heroSeries.length > 0 && (
                  <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
                    {heroSeries.map((s) => (
                      <span
                        key={s.name}
                        className={`rounded-[2px] border px-[7px] py-[2px] font-sans text-[11px] ${
                          s.isActive ? 'border-line-3 bg-surface-2 font-medium text-ink' : 'border-line-2 bg-surface-2 text-ink-2'
                        }`}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
                {!isAuthenticated && (
                  <p className="mt-[16px] max-w-[62ch] font-sans text-[14px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
                    Endurance fantasy racing: pick your teams and drivers within a salary cap and rack up points as they race.
                  </p>
                )}
              </div>

              {/* timing + action */}
              {nextEvent && (
                <div className="w-full lg:w-[340px] lg:shrink-0">
                  <div className="rounded-[3px] border border-line bg-black px-4 py-[14px]">
                    <div className="mb-[7px] flex items-center gap-[7px]">
                      <span className="h-[10px] w-[4px] flex-none bg-brand [transform:skewX(-14deg)]" />
                      <span className="font-display text-[11px] tracking-[0.16em] text-muted">
                        {heroOpen ? 'PICKS LOCK IN' : 'WEEKEND LOCKS IN'}
                      </span>
                    </div>
                    <div className="font-mono text-[34px] font-bold tracking-[0.02em] text-ink">{heroCd.text}</div>
                    {heroLockIso && (
                      <div className="mt-[6px] font-mono text-[11px] tracking-[0.08em] text-muted">{fmtLockTime(heroLockIso)}</div>
                    )}
                  </div>
                  {/* When the registration banner is on screen its CTA is THE primary action — the hero's
                      copy of it demotes to a secondary button so only one red italic CTA exists per view
                      (The Italic-Restraint Rule / One Red Rule). */}
                  <button
                    type="button"
                    onClick={onHeroCta}
                    className={`mt-4 flex h-[46px] w-full items-center justify-center gap-2 rounded-[3px] cursor-pointer transition-colors ${
                      needsRegistration
                        ? 'border border-line-2 bg-surface text-ink-2 hover:border-line-3 hover:text-ink'
                        : 'bg-brand text-ink hover:bg-brand-2'
                    }`}
                  >
                    {needsRegistration && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <rect x="5" y="11" width="14" height="10" rx="1.5" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    )}
                    <span className={`font-display text-[17px] font-bold tracking-[0.06em] uppercase ${needsRegistration ? '' : 'italic'}`}>
                      {!isAuthenticated ? 'Sign in to Play' : needsRegistration ? 'Register to Set Lineup' : 'Set Your Lineup →'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* The whole game in three beats — shown to anyone without a team, since the hero's CTA
              otherwise asks for a Google sign-in on faith. Same chip/mono vocabulary as the hero
              label; deliberately a strip, not a card grid. */}
          {!hasAnyRegistration && <HowItWorks />}
        </div>

        {/* upcoming events — full-width, natural height; the hero's event is promoted above */}
        <div className="min-w-0">
          <div className="flex items-center justify-between px-4 pb-[14px] pt-[18px] sm:px-[26px]">
            <h2 className="font-display text-[22px] font-extrabold uppercase text-ink">Race Calendar</h2>
          </div>
          <div className="font-mono">
            {calLoading ? (
              <div className="px-4 py-6 sm:px-[26px]">
                <SkeletonTable />
              </div>
            ) : calError ? (
              <div className="px-4 py-6 sm:px-[26px]">
                <ErrorBox message="Couldn't load the schedule." />
              </div>
            ) : calendar.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-muted sm:px-[26px]">
                The {active?.season.year ?? ''} schedule hasn't been published yet.
              </p>
            ) : upcomingRows.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-muted sm:px-[26px]">
                That's the season — no events after this one.
              </p>
            ) : (
              upcomingRows.map((item) => (
                <CalendarRow
                  key={item.key}
                  item={item}
                  champId={active?.championship.id}
                  seasonId={active?.season.id}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <GlobalLeaderboard seasonId={active?.season.id} myRegistrationId={registration?.id} />

      {active && <RegisterModal seasonId={active.season.id} open={modalOpen} onOpenChange={setModalOpen} />}
    </>
  )
}

/**
 * The three beats of a race weekend, in order. Terse on purpose — this is a strip under the hero,
 * not a feature section: enough for a first-time visitor to know what signing in buys them.
 */
const BEATS = [
  { key: 'Pick', detail: 'teams & drivers under a salary cap' },
  { key: 'Lock', detail: 'lineups freeze when qualifying starts' },
  { key: 'Score', detail: 'points from qualifying + race position' },
] as const

/** A single-row (lg+) / stacked (below lg) how-it-works strip in the hero band's own vocabulary. */
function HowItWorks() {
  return (
    <div className="border-t border-line px-4 pb-[22px] pt-[18px] sm:px-[26px] lg:pb-[20px]">
      <div className="flex flex-col gap-[9px] lg:flex-row lg:items-baseline lg:gap-0">
        <span className="font-mono text-[11px] tracking-[0.14em] text-muted lg:mr-[22px] lg:shrink-0">
          // HOW_IT_WORKS
        </span>
        {BEATS.map((b, i) => (
          // The arrow leads its own beat rather than floating between flex columns, so every beat
          // starts on the same left edge and the sequence still reads left-to-right.
          <div key={b.key} className="flex min-w-0 items-baseline gap-[10px] lg:flex-1">
            {i > 0 && (
              <svg
                className="hidden shrink-0 -translate-y-[1px] self-center text-muted lg:block"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
            <span className="w-[46px] shrink-0 font-display text-[13px] font-bold uppercase tracking-[0.1em] text-ink lg:w-auto">
              {b.key}
            </span>
            <span className="font-sans text-[13px] leading-[1.45] text-ink-2">{b.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * One weekend on the unified calendar (sm+ grid + mobile card). Owns its own lock countdown from the
 * active championship's quali_start when it races this weekend; otherwise it shows the weekend with all
 * its series and no pick-lock (the active championship sits this one out). Three lines: round / track /
 * series pills (the active championship's pill is highlighted).
 */
function CalendarRow({
  item,
  champId,
  seasonId,
}: {
  item: CalItem
  champId?: number
  seasonId?: number
}) {
  // Count down to the first series' quali (the next lock). useCountdown re-renders every second, so the
  // derived status below stays live as the weekend crosses into IN_PROGRESS.
  const cd = useCountdown(item.earliestQuali)
  // Status comes from the shared lifecycle (deriveEventStatus), same source of truth as the dashboard
  // and admin. Both qualis go in so IN_PROGRESS can time-decay to AWAITING off the LAST lock.
  const status = deriveEventStatus(
    {
      picksOpen: item.picksOpen,
      scored: item.scored,
      finalized: item.finalized,
      rounds: [{ qualiStart: item.earliestQuali }, { qualiStart: item.latestQuali }],
    },
    Date.now(),
  )
  // Countdown only reads meaningfully before lock (Picks Open / Coming Soon); afterwards there's
  // nothing to count down to and the cell stays empty rather than printing a dead "—".
  const text = status === 'OPEN' || status === 'WAITING' ? cd.text : ''
  const hi = status === 'OPEN'
  const dim = status === 'CLOSED' // retired weekends recede
  // Every row is a door — and now says where it goes. Open rounds link to their pick board; a
  // weekend whose results are in deep-links to THAT round's board (?round=); anything else falls
  // back to the season pool, scoped to the series/year we know about.
  const scope = [champId != null && `champ=${champId}`, seasonId != null && `season=${seasonId}`]
    .filter(Boolean)
    .join('&')
  const standingsHref = (roundId?: number) => {
    const q = [scope, roundId != null && `round=${roundId}`].filter(Boolean).join('&')
    return q ? `/standings?${q}` : '/standings'
  }
  const canDeepLink = (status === 'SCORED' || status === 'CLOSED') && item.activeRoundId != null
  const href =
    status === 'OPEN' && item.activeRoundId != null
      ? `/pick/${item.activeRoundId}`
      : standingsHref(canDeepLink ? item.activeRoundId : undefined)
  const action = hi && item.activeRoundId != null ? 'Set lineup' : canDeepLink ? 'View results' : 'View standings'
  const label = item.seq != null ? `R${String(item.seq).padStart(2, '0')}` : '·'
  const date = fmtDate(new Date(item.dateMs).toISOString()).toUpperCase()
  const pillClass = `inline-block rounded-[2px] px-[9px] py-[3px] font-display text-[11px] tracking-[0.06em] ${statusStyle[status]}`
  const badge = <span className={`${pillClass} shrink-0`}>{statusLabel[status]}</span>
  // The row's destination, always visible so it isn't a mystery-meat link. Quiet at rest (muted is
  // the contrast floor for de-emphasised text), brightening with the row on hover.
  const actionLabel = (
    <span
      className={`whitespace-nowrap text-[10px] tracking-[0.1em] uppercase transition-colors ${
        hi ? 'text-brand-3' : 'text-muted'
      } group-hover:text-ink-2`}
    >
      {action} →
    </span>
  )
  // All series racing this weekend, the active championship highlighted. Retired weekends recede by
  // dropping the pill FILL (a non-text signal) rather than fading the row — row opacity stacked on
  // already-muted 11px text and broke AA contrast.
  const pills = (
    <div className="mt-[5px] flex flex-wrap items-center gap-[5px]">
      {item.series.map((s) => (
        <span
          key={s.name}
          className={`rounded-[2px] border px-[6px] py-[2px] text-[11px] ${
            dim
              ? 'border-line bg-transparent text-muted'
              : s.isActive
                ? 'border-line-3 bg-surface-2 font-medium text-ink'
                : 'border-line-2 bg-surface-2 text-ink-2'
          }`}
        >
          {s.name}
        </span>
      ))}
    </div>
  )
  const titleColor = dim ? 'text-ink-2' : 'text-ink'

  return (
    <Fragment>
      {/* sm+ : grid row (a link — open rounds go to their pick board, the rest to standings) */}
      <Link
        to={href}
        className={`group hidden grid-cols-[54px_1fr_112px_120px_132px] items-center border-b border-line px-[26px] py-[13px] transition-colors sm:grid ${
          hi ? 'border-t border-t-line bg-brand/[0.07] hover:bg-brand/[0.12]' : 'hover:bg-surface-2'
        }`}
      >
        <span className={`text-[13px] font-bold ${hi ? 'text-brand-2' : 'text-muted'}`}>{label}</span>
        <div>
          <div className={`font-display text-[17px] font-bold uppercase ${titleColor}`}>{item.title}</div>
          {item.track && <div className="text-[11px] text-muted">{item.track}</div>}
          {pills}
        </div>
        <span className="text-[13px] text-ink-2">{date}</span>
        <div>{badge}</div>
        <div className="text-right">
          {text && <div className={`text-[12px] ${hi ? 'text-brand-2' : 'text-muted'}`}>{text}</div>}
          <div className={text ? 'mt-[4px]' : ''}>{actionLabel}</div>
        </div>
      </Link>

      {/* < sm : card (same link; active state gives touch feedback) */}
      <Link
        to={href}
        className={`group flex flex-col gap-[7px] border-b border-line px-4 py-3 transition-colors sm:hidden ${
          hi ? 'border-t border-t-line bg-brand/[0.07] active:bg-brand/[0.12]' : 'active:bg-surface-2'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-[2px] text-[13px] font-bold ${hi ? 'text-brand-2' : 'text-muted'}`}>{label}</span>
          <div className="min-w-0 flex-1">
            <div className={`font-display text-[16px] font-bold uppercase ${titleColor}`}>{item.title}</div>
            {item.track && <div className="text-[11px] text-muted">{item.track}</div>}
            {pills}
          </div>
          {badge}
        </div>
        <div className="flex items-center justify-between gap-3 pl-[27px] text-[12px]">
          <span className="min-w-0 truncate text-ink-2">
            {date}
            {text && <span className={`ml-[10px] ${hi ? 'text-brand-2' : 'text-muted'}`}>{text}</span>}
          </span>
          {actionLabel}
        </div>
      </Link>
    </Fragment>
  )
}

/** Bottom of the Landing: the real season pool (top rows) + live player/league counts. */
function GlobalLeaderboard({ seasonId, myRegistrationId }: { seasonId?: number; myRegistrationId?: number }) {
  const lb = useSeasonLeaderboard(seasonId)
  const top = (lb.data?.entries ?? []).slice(0, 8)
  const stats = useGlobalStats()

  return (
    <div className="border-t border-line bg-bg px-4 py-7 sm:px-[26px]">
      <div className="mb-[14px] flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 className="font-display text-[22px] font-extrabold uppercase text-ink">Global Leaderboard</h2>
        <div className="flex items-center gap-5">
          {stats.data && (
            <span className="font-mono text-[11px] tracking-[0.08em] text-muted">
              {stats.data.players.toLocaleString()} PLAYERS · {stats.data.leagues.toLocaleString()} LEAGUES
            </span>
          )}
          <Link to="/standings" className="font-display text-[12px] font-semibold uppercase tracking-[0.05em] text-muted hover:text-ink-2 transition-colors">
            Full standings →
          </Link>
        </div>
      </div>
      {lb.isLoading ? (
        <SkeletonTable />
      ) : lb.isError ? (
        <ErrorBox message="Couldn't load the global board." />
      ) : (
        <Leaderboard
          entries={top}
          myRegistrationId={myRegistrationId}
          emptyMessage="The global board opens once the first round is scored."
        />
      )}
    </div>
  )
}
