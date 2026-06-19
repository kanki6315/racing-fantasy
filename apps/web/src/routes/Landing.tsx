import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { demoStats } from '../lib/demoStats'
import { Demo } from '../components/Demo'
import { Leaderboard } from '../components/Leaderboard'
import { RegisterModal } from '../components/RegisterModal'
import { ErrorBox, SkeletonTable } from './LeagueStandings'
import { useAuth } from '../auth/AuthContext'
import { useActiveSeason, useSeasonLeaderboard, useRounds, useEvents } from '../api/queries'
import { useCountdown } from '../lib/useCountdown'

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
  picksOpen: boolean // admin-released the board for this weekend → gates COMING SOON vs PICKS OPEN
  earliestQuali: string // soonest quali across the weekend's series — drives PICKS OPEN → CLOSING
  latestQuali: string // last quali across the weekend's series — once passed, the weekend is LOCKED
}

const statusStyle: Record<string, string> = {
  'PICKS OPEN': 'text-ink bg-brand',
  'PICKS CLOSING': 'text-ink bg-warn',
  'COMING SOON': 'text-ink-2 bg-line',
  LOCKED: 'text-muted bg-surface-2',
}

/** "Jun 28" from an ISO date. */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Landing (public + logged-in variants). The championships strip (in the shell) is live; hero +
 * calendar are demo content until F3. When a signed-in user isn't registered for the active season,
 * the registration call-out + team-name modal appear (the front of F2).
 */
export function Landing() {
  const { isAuthenticated, user, loginWithGoogle } = useAuth()
  const { data: active } = useActiveSeason()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)

  // Season calendar — event-centric (ADR-0007). The unified weekend calendar: every event (with all
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
        earliestQuali: new Date(Math.min(...qualis)).toISOString(),
        latestQuali: new Date(Math.max(...qualis)).toISOString(),
      })
    }
    return items.sort((a, b) => a.dateMs - b.dateMs)
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
    else navigate('/dashboard')
  }

  return (
    <>
      {/* registration call-out — signed in but not yet entered this season */}
      {needsRegistration && (
        <div className="relative flex items-center gap-[34px] overflow-hidden border-b border-[#2a0d0c] bg-[linear-gradient(110deg,#1a0604_0%,#120608_46%,#0a0b0d_100%)] px-4 py-7 sm:px-[30px] sm:py-[30px]">
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_22px,rgba(225,6,0,0.04)_22px_23px)]" />
          <div className="relative min-w-0 flex-1">
            <div className="mb-[13px] inline-flex h-6 items-center gap-2 rounded-[2px] bg-brand px-[11px]">
              <span className="h-[6px] w-[6px] rounded-full bg-ink [animation:blink_1.4s_infinite]" />
              <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-ink">2026 REGISTRATION OPEN</span>
            </div>
            <div className="font-display text-[26px] font-extrabold italic uppercase leading-[0.96] text-ink sm:text-[34px]">
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
                className="flex h-12 items-center justify-center gap-[9px] rounded-[3px] bg-brand px-[26px] cursor-pointer hover:bg-[#ff140d] transition-colors"
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

      <div className="flex flex-col bg-black lg:flex-row">
        {/* hero — next round + lock countdown */}
        <div className="w-full border-b border-line bg-gradient-to-b from-surface-3 to-bg px-4 py-[26px] sm:px-7 lg:w-[420px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="mb-[14px] font-mono text-[11px] tracking-[0.14em] text-brand">// NEXT_EVENT</div>
          <h1 className="font-display text-[34px] font-extrabold italic uppercase leading-[0.92] text-ink sm:text-[40px]">
            {heroTitle}
          </h1>
          {heroWhere && <div className="mt-[10px] font-sans text-[14px] text-muted">{heroWhere}</div>}
          {heroSeries.length > 0 && (
            <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
              {heroSeries.map((s) => (
                <span
                  key={s.name}
                  className={`rounded-[2px] border px-[7px] py-[2px] font-sans text-[11px] ${
                    s.isActive ? 'border-brand/50 bg-brand/10 text-brand-3' : 'border-line-2 bg-surface-2 text-ink-2'
                  }`}
                >
                  {s.name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-[22px] rounded-[3px] border border-line border-l-[3px] border-l-brand bg-black px-4 py-[14px]">
            <div className="mb-[7px] font-display text-[11px] tracking-[0.16em] text-muted-2">PICKS LOCK IN</div>
            <div className="font-mono text-[34px] font-bold tracking-[0.02em] text-ink">{heroCd.text}</div>
          </div>

          <button
            type="button"
            onClick={onHeroCta}
            className="mt-4 flex h-[46px] w-full items-center justify-center gap-2 rounded-[3px] bg-brand cursor-pointer"
          >
            {needsRegistration && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
                <rect x="5" y="11" width="14" height="10" rx="1.5" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            )}
            <span className="font-display text-[17px] font-bold italic tracking-[0.06em] uppercase text-ink">
              {needsRegistration ? 'Register to Set Lineup' : 'Set Your Lineup →'}
            </span>
          </button>
          {needsRegistration && (
            <div className="mt-[10px] flex items-center justify-center gap-[7px]">
              <span className="font-sans text-[12px] text-muted-2">Lineups unlock once you've claimed a team name</span>
            </div>
          )}
        </div>

        {/* season calendar */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between px-4 pb-[14px] pt-[18px] sm:px-[26px]">
            <h2 className="font-display text-[22px] font-extrabold italic uppercase text-ink">Season Calendar</h2>
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
              <p className="px-4 py-6 text-[13px] text-muted-2 sm:px-[26px]">
                The {active?.season.year ?? ''} schedule hasn't been published yet.
              </p>
            ) : (
              calendar.map((item) => (
                <CalendarRow key={item.key} item={item} />
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
 * One weekend on the unified calendar (sm+ grid + mobile card). Owns its own lock countdown from the
 * active championship's quali_start when it races this weekend; otherwise it shows the weekend with all
 * its series and no pick-lock (the active championship sits this one out). Three lines: round / track /
 * series pills (the active championship's pill is highlighted).
 */
function CalendarRow({ item }: { item: CalItem }) {
  const earliest = +new Date(item.earliestQuali)
  const latest = +new Date(item.latestQuali)
  // Count down to whichever lock boundary is next. useCountdown re-renders every second, so the phase
  // stays current.
  const cd = useCountdown(Date.now() < earliest ? item.earliestQuali : item.latestQuali)
  const now = Date.now()
  // Status machine: a passed weekend is LOCKED; an un-released board is COMING SOON; once the admin
  // opens the event (Event.picksOpen) picks are OPEN until the first series qualifies, then CLOSING as
  // each series locks in turn. Openness is per-event, so any number of weekends can be open at once.
  const status =
    now >= latest ? 'LOCKED' : !item.picksOpen ? 'COMING SOON' : now < earliest ? 'PICKS OPEN' : 'PICKS CLOSING'
  const text = status === 'LOCKED' ? '—' : cd.text
  const hi = status === 'PICKS OPEN'
  const label = item.seq != null ? `R${String(item.seq).padStart(2, '0')}` : '·'
  const date = fmtDate(new Date(item.dateMs).toISOString()).toUpperCase()
  const closing = status === 'PICKS CLOSING'
  const pillClass = `inline-block rounded-[2px] px-[9px] py-[3px] font-display text-[11px] tracking-[0.06em] ${statusStyle[status]}`
  const badge = closing ? (
    <span className="group relative inline-block shrink-0" tabIndex={0}>
      <span className={`${pillClass} cursor-help`}>{status}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-30 mt-[7px] hidden w-[210px] rounded-[4px] border border-line-2 bg-surface-3 px-3 py-2 font-sans text-[11px] leading-snug text-ink shadow-[0_8px_24px_rgba(0,0,0,0.5)] group-hover:block group-focus-within:block"
      >
        Once Qualifying starts, picks for a Championship are locked
      </span>
    </span>
  ) : (
    <span className={`${pillClass} shrink-0`}>{status}</span>
  )
  // All series racing this weekend, the active championship highlighted.
  const pills = (
    <div className="mt-[5px] flex flex-wrap items-center gap-[5px]">
      {item.series.map((s) => (
        <span
          key={s.name}
          className={`rounded-[2px] border px-[6px] py-[1px] text-[10px] ${
            s.isActive ? 'border-brand/50 bg-brand/10 text-brand-3' : 'border-line-2 bg-surface-2 text-ink-2'
          }`}
        >
          {s.name}
        </span>
      ))}
    </div>
  )

  return (
    <Fragment>
      {/* sm+ : grid row */}
      <div
        className={`hidden grid-cols-[54px_1fr_130px_120px_110px] items-center border-b border-line px-[26px] py-[13px] sm:grid ${
          hi ? 'border-t border-t-line bg-brand/[0.07]' : ''
        }`}
      >
        <span className={`text-[13px] font-bold ${hi ? 'text-brand' : 'text-muted'}`}>{label}</span>
        <div>
          <div className="font-display text-[17px] font-bold uppercase text-ink">{item.title}</div>
          {item.track && <div className="text-[11px] text-muted-2">{item.track}</div>}
          {pills}
        </div>
        <span className="text-[13px] text-ink-2">{date}</span>
        <div>{badge}</div>
        <span className={`text-right text-[12px] ${hi ? 'text-brand' : 'text-muted-2'}`}>{text}</span>
      </div>

      {/* < sm : card */}
      <div
        className={`flex flex-col gap-[7px] border-b border-line px-4 py-3 sm:hidden ${
          hi ? 'border-t border-t-line bg-brand/[0.07]' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-[2px] text-[13px] font-bold ${hi ? 'text-brand' : 'text-muted'}`}>{label}</span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[16px] font-bold uppercase text-ink">{item.title}</div>
            {item.track && <div className="text-[11px] text-muted-2">{item.track}</div>}
            {pills}
          </div>
          {badge}
        </div>
        <div className="flex items-center justify-between pl-[27px] text-[12px]">
          <span className="text-ink-2">{date}</span>
          <span className={`${hi ? 'text-brand' : 'text-muted-2'}`}>{text}</span>
        </div>
      </div>
    </Fragment>
  )
}

/** Bottom of the Landing: the real season pool (top rows) + demo stat tiles. */
function GlobalLeaderboard({ seasonId, myRegistrationId }: { seasonId?: number; myRegistrationId?: number }) {
  const { global } = demoStats
  const lb = useSeasonLeaderboard(seasonId)
  const top = (lb.data?.entries ?? []).slice(0, 8)

  return (
    <div className="flex flex-col gap-6 border-t border-line bg-bg px-4 py-7 sm:px-[26px] lg:flex-row">
      {/* stat tiles (mocked) */}
      <div className="flex shrink-0 gap-3 lg:w-[300px] lg:flex-col">
        <div className="mb-1 hidden font-display text-[11px] tracking-[0.14em] uppercase text-muted-2 lg:block">// SEASON_PULSE</div>
        <Tile label="Players" value={global.players.toLocaleString()} />
        <Tile label="Leagues" value={global.leagues.toLocaleString()} />
      </div>

      {/* global leaderboard (real) */}
      <div className="min-w-0 flex-1">
        <div className="mb-[14px] flex items-end justify-between">
          <h2 className="font-display text-[22px] font-extrabold italic uppercase text-ink">Global Leaderboard</h2>
          <Link to="/standings" className="font-display text-[12px] font-semibold uppercase tracking-[0.05em] text-muted hover:text-ink-2 transition-colors">
            Full standings →
          </Link>
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
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-[3px] border border-line border-l-[3px] border-l-brand bg-surface px-4 py-[14px]">
      <div className="font-display text-[11px] tracking-[0.12em] uppercase text-muted-2">{label}</div>
      <Demo>
        <div className="mt-1 font-mono text-[26px] font-bold text-ink">{value}</div>
      </Demo>
    </div>
  )
}
