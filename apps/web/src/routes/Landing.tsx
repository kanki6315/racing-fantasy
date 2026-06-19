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

/** One weekend on the unified calendar (ADR-0007) — an event (multi-series) or a standalone round. */
type CalSeries = { name: string; isActive: boolean }
type CalItem = {
  key: string
  seq?: number // the active championship's round number this weekend, if it races
  title: string
  track: string
  dateMs: number
  series: CalSeries[]
  activeRoundId?: number // the active championship's round here, if any (drives status/countdown)
  qualiStart?: string
}

const statusStyle: Record<string, string> = {
  'PICKS OPEN': 'text-ink bg-brand',
  UPCOMING: 'text-ink-2 bg-line',
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
  // The active championship's soonest upcoming round drives the hero + the "PICKS OPEN" highlight.
  const nextRound = activeRounds
    .filter((r) => new Date(r.qualiStart).getTime() > now)
    .sort((a, b) => +new Date(a.qualiStart) - +new Date(b.qualiStart))[0]
  const nextRoundId = nextRound?.id

  const calendar = useMemo<CalItem[]>(() => {
    if (!active) return []
    const seqByRoundId = new Map(activeRounds.map((r) => [r.id, r.sequence]))
    const items: CalItem[] = []
    // Events = shared weekends: list every series racing, flag the active championship's round if present.
    for (const e of eventsQ.data ?? []) {
      const evRounds = e.rounds.filter((r) => r.year === active.season.year)
      if (evRounds.length === 0) continue
      const mine = evRounds.find((r) => r.championshipId === active.championship.id)
      const names = [...new Set(evRounds.map((r) => r.championshipName))]
      items.push({
        key: `e${e.id}`,
        seq: mine ? seqByRoundId.get(mine.roundId) : undefined,
        title: e.name,
        track: e.circuit ?? '',
        dateMs: e.startsAt ? +new Date(e.startsAt) : Math.min(...evRounds.map((r) => +new Date(r.qualiStart))),
        series: names.map((n) => ({ name: n, isActive: n === active.championship.name })),
        activeRoundId: mine?.roundId,
        qualiStart: mine?.qualiStart,
      })
    }
    // Standalone active-championship rounds (no event) = single-series weekends.
    for (const r of activeRounds) {
      if (r.eventId != null) continue
      items.push({
        key: `r${r.id}`,
        seq: r.sequence,
        title: r.name,
        track: r.circuit ?? '',
        dateMs: +new Date(r.startsAt ?? r.qualiStart),
        series: [{ name: active.championship.name, isActive: true }],
        activeRoundId: r.id,
        qualiStart: r.qualiStart,
      })
    }
    return items.sort((a, b) => a.dateMs - b.dateMs)
  }, [active, eventsQ.data, activeRounds])

  const calLoading = roundsQ.isLoading || eventsQ.isLoading
  const calError = roundsQ.isError || eventsQ.isError

  // Hero "next round" — the soonest upcoming round + its live lock countdown.
  const heroCd = useCountdown(nextRound?.qualiStart)
  const heroBadge = nextRound
    ? `RD ${String(nextRound.sequence).padStart(2, '0')} — ${(active?.championship.name ?? '').toUpperCase()}`
    : '// SEASON'
  const heroTitle = nextRound?.name ?? (activeRounds.length ? 'Season complete' : 'Schedule coming soon')
  const heroWhere = nextRound
    ? [nextRound.circuit, fmtDate(nextRound.startsAt ?? nextRound.qualiStart)].filter(Boolean).join(' · ')
    : ''
  // All series racing the hero weekend (only worth showing when it's a shared event, i.e. >1 series).
  const heroSeries = (nextRound && calendar.find((c) => c.activeRoundId === nextRound.id)?.series) || []

  const registration =
    active && user ? (user.registrations.find((r) => r.seasonId === active.season.id) ?? null) : null
  const needsRegistration = isAuthenticated && !!active && !registration

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
          <div className="mb-[14px] font-mono text-[11px] tracking-[0.14em] text-brand">// NEXT_ROUND</div>
          <div className="mb-[6px] font-mono text-[12px] text-muted-2">{heroBadge}</div>
          <h1 className="font-display text-[34px] font-extrabold italic uppercase leading-[0.92] text-ink sm:text-[40px]">
            {heroTitle}
          </h1>
          {heroWhere && <div className="mt-[10px] font-sans text-[14px] text-muted">{heroWhere}</div>}
          {heroSeries.length > 1 && (
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
                <CalendarRow key={item.key} item={item} isNext={item.activeRoundId === nextRoundId} />
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
function CalendarRow({ item, isNext }: { item: CalItem; isNext: boolean }) {
  const cd = useCountdown(item.qualiStart)
  const racing = item.activeRoundId != null
  const status = racing ? (cd.locked ? 'LOCKED' : isNext ? 'PICKS OPEN' : 'UPCOMING') : null
  const hi = racing && isNext && !cd.locked
  const label = item.seq != null ? `R${String(item.seq).padStart(2, '0')}` : '·'
  const date = fmtDate(new Date(item.dateMs).toISOString()).toUpperCase()
  const badge = status && (
    <span className={`shrink-0 rounded-[2px] px-[9px] py-[3px] font-display text-[11px] tracking-[0.06em] ${statusStyle[status]}`}>
      {status}
    </span>
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
        <span className={`text-right text-[12px] ${hi ? 'text-brand' : 'text-muted-2'}`}>{racing ? cd.text : '—'}</span>
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
          {racing && <span className={`${hi ? 'text-brand' : 'text-muted-2'}`}>{cd.text}</span>}
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
