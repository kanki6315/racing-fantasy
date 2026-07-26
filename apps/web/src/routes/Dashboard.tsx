import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, type Me } from '../auth/AuthContext'
import {
  useAllSeasons,
  useChampionships,
  useClasses,
  useDiscoverLeagues,
  useEvents,
  useJoinLeague,
  useLeagueLeaderboard,
  useMyLeagues,
  usePlayerPicks,
  usePrices,
  useRoster,
  useUpdateEmailPreference,
  ApiError,
  type ClassDto,
  type League,
} from '../api/queries'
import { classMeta } from '../lib/classMeta'
import { fmtMoney, fmtPts, fmtSeasonPoints, fmtTotal, hasScored, sourceLabel } from '../lib/scoreFormat'
import { useCountdown, useNow } from '../lib/useCountdown'
import { CreateLeagueModal, JoinByCodeModal } from '../components/LeagueModals'
import { RegisterModal } from '../components/RegisterModal'
import { RateLimitModal } from '../components/RateLimitModal'
import { EntityThumb } from '../components/EntityThumb'
import { DriverLineup } from '../components/DriverLineup'
import { EmailPreferenceControls, prefsFromList } from '../components/EmailPreferences'
import { deriveEventStatus, isShownOnDashboard, EVENT_STATUS_META } from '../lib/eventStatus'

type Registration = Me['registrations'][number]

type PickRound = { id: number; name: string; qualiStart: string }
type PickRow = { reg: Registration; round: PickRound; champName: string; champOrder: number }
type PickCard = {
  eventId: number
  eventName: string
  eventCircuit: string | null
  startsAt: string | null
  scored: boolean
  firstQuali: string | null
  rows: PickRow[]
}

/** The player home (F3): your-picks status per series + your leagues + discover. */
export function Dashboard() {
  const { user } = useAuth()
  const champs = useChampionships()
  const seasons = useAllSeasons()
  const myLeagues = useMyLeagues()
  const events = useEvents()
  const classes = useClasses()
  const updatePref = useUpdateEmailPreference()
  const [rateLimited, setRateLimited] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinSeasonId, setJoinSeasonId] = useState<number | null>(null)

  // One lookup for every racing class in the app — a hub showing picks from several championships
  // resolves class identity from this rather than paying a per-round roster-rules request per row.
  const classById = useMemo(
    () => new Map((classes.data ?? []).map((c) => [c.id, c])),
    [classes.data],
  )

  const seasonInfo = useMemo(() => {
    return (seasonId: number) => {
      const s = seasons.data?.find((x) => x.id === seasonId)
      const c = champs.data?.find((x) => x.id === s?.championshipId)
      return { champName: c?.name ?? 'Championship', year: s?.year }
    }
  }, [seasons.data, champs.data])

  // Championships the user hasn't registered for → a "join" pill seeded to that champ's latest season.
  const joinable = useMemo(() => {
    const regList = user?.registrations ?? []
    const allSeasons = seasons.data ?? []
    const registeredChampIds = new Set(
      regList.map((r) => allSeasons.find((s) => s.id === r.seasonId)?.championshipId),
    )
    return (champs.data ?? [])
      .filter((c) => !registeredChampIds.has(c.id))
      .map((c) => {
        const season = allSeasons
          .filter((s) => s.championshipId === c.id)
          .sort((a, b) => b.year - a.year)[0]
        return season ? { champId: c.id, name: c.name, seasonId: season.id, year: season.year } : null
      })
      .filter((x): x is { champId: number; name: string; seasonId: number; year: number } => x != null)
  }, [user?.registrations, seasons.data, champs.data])

  // Cards are grouped by the event's lifecycle status (ADR-0008 amendment): one card per weekend that's
  // OPEN / IN_PROGRESS / SCORED, one row per championship the user is registered in. Waiting-to-open (not
  // released) and Closed (finalized) weekends drop off. No shown events → "no picks to be made".
  const picksCards = useMemo<PickCard[]>(() => {
    const regList = user?.registrations ?? []
    const cards: PickCard[] = []
    for (const e of events.data ?? []) {
      if (!isShownOnDashboard(deriveEventStatus(e))) continue
      const rows: PickRow[] = []
      for (const er of e.rounds) {
        const reg = regList.find((r) => r.seasonId === er.seasonId)
        if (!reg) continue
        rows.push({
          reg,
          round: { id: er.roundId, name: er.roundName, qualiStart: er.qualiStart },
          champName: er.championshipName,
          champOrder: er.championshipOrder,
        })
      }
      if (rows.length === 0) continue
      rows.sort((a, b) => a.champOrder - b.champOrder)
      // Earliest quali across ALL the weekend's series (not just the user's rows) = the first round to
      // lock. Same basis as the deriveEventStatus filter above, so the badge and visibility agree.
      const firstQuali = e.rounds.reduce<string | null>(
        (min, r) => (min == null || r.qualiStart < min ? r.qualiStart : min),
        null,
      )
      cards.push({
        eventId: e.id, eventName: e.name, eventCircuit: e.circuit, startsAt: e.startsAt,
        scored: e.scored, firstQuali, rows,
      })
    }
    cards.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? '') || a.eventName.localeCompare(b.eventName))
    return cards
  }, [user?.registrations, events.data])

  /**
   * The round whose lock comes first, across every weekend on the page — the page's one urgent action.
   *
   * The One Red Rule allows a view two solid-red spends, and this page had four: one per unset row
   * plus Create League, a count that grows with weekends x registered series. So exactly one row may
   * wear solid red, and it is the one with the least time left. Derived from quali time alone rather
   * than from whether each row is set, because "is it set" is per-row async state and coordinating it
   * across cards would cost more than the signal is worth; the row itself still declines the red when
   * it turns out to have a lineup already.
   *
   * `now` comes from state and MUST stay in the dep list. Read straight from `Date.now()` the
   * timestamp froze at first render, so on a tab left open across a race weekend — which is how this
   * page is actually used — urgency never moved. Worse, once the frozen favourite locked, its row
   * declined the red on its own and nothing else could claim it: the page quietly ended up with no
   * primary action at all. A minute's granularity is plenty for a deadline measured in hours.
   */
  const now = useNow(60_000)
  const urgentRoundId = useMemo(() => {
    let best: { id: number; at: number } | null = null
    for (const card of picksCards) {
      for (const row of card.rows) {
        const at = Date.parse(row.round.qualiStart)
        if (Number.isNaN(at) || at <= now) continue
        if (!best || at < best.at) best = { id: row.round.id, at }
      }
    }
    return best?.id ?? null
  }, [picksCards, now])

  if (!user) return null
  const regs = user.registrations
  const leagues = myLeagues.data ?? []
  // A count is a claim, and `?? []` turns a failed request into the claim "zero". The main column
  // already says "Couldn't load your leagues" in that case, so leaving these at 0 had one screen
  // telling a player two different things about one failed request. An em-dash says "unknown",
  // which is the truth.
  const leagueCount: number | string = myLeagues.isError ? '—' : leagues.length
  const countBy = (v: 'Public' | 'Private'): number | string =>
    myLeagues.isError ? '—' : leagues.filter((l) => l.visibility === v).length
  const primarySeason = regs[0]?.seasonId

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* left rail — full-width below the content on mobile, fixed left rail at lg+ */}
      <aside className="order-last w-full flex-none border-t border-line bg-surface-3 p-[18px] pt-6 lg:order-first lg:w-[268px] lg:border-r lg:border-t-0">
        <div className="font-display text-[26px] font-extrabold uppercase text-ink">My Team</div>
        <div className="mb-5 font-sans text-[12px] text-muted">
          {regs.length} series · {leagueCount} leagues · {regs[0] ? seasonInfo(regs[0].seasonId).year : '—'}
        </div>

        <div className="mb-[11px] font-display text-[11px] tracking-[0.12em] uppercase text-muted">Championships</div>
        <div className="flex flex-col gap-1">
          {regs.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-[3px] border border-success/50 bg-success/[0.06] px-[13px] py-[10px]">
              <span className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-ink">
                {/* The slash takes the card's own state hue — a red one per registered series put
                    four extra reds in the sidebar for no signal. */}
                <span className="h-[15px] w-[4px] flex-none bg-success [transform:skewX(-14deg)]" />
                {seasonInfo(r.seasonId).champName}
              </span>
              <svg className="h-[15px] w-[15px] flex-none text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="Signed up">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ))}
          {regs.length === 0 && <div className="font-sans text-[12px] text-muted">No series yet.</div>}
          {joinable.map((j) => (
            <button
              key={j.champId}
              onClick={() => setJoinSeasonId(j.seasonId)}
              // A series you could join is an attention state, so it speaks warn orange — the same
              // hue as the nav's NOT REGISTERED pill. It used to be #a855f7 purple, a color that
              // exists nowhere in the palette and read as the loudest thing on the page.
              className="flex min-h-[42px] items-center justify-between gap-2 rounded-[3px] border border-dotted border-warn/50 bg-warn/[0.06] px-[13px] py-[10px] text-left transition-colors hover:border-warn/70 hover:bg-warn/[0.1] pointer-coarse:min-h-11 cursor-pointer"
            >
              <span className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2">
                <span className="h-[15px] w-[4px] flex-none bg-warn [transform:skewX(-14deg)]" />
                {j.name}
              </span>
              <span className="flex-none font-display text-[11px] font-bold uppercase tracking-[0.06em] text-warn">
                Sign Up
              </span>
            </button>
          ))}
        </div>

        <div className="my-5 h-px bg-line" />
        <div className="mb-[11px] font-display text-[11px] tracking-[0.12em] uppercase text-muted">Leagues</div>
        <div className="flex flex-col gap-1 font-display text-[13px] font-semibold uppercase tracking-[0.04em]">
          <Row label="All Leagues" value={leagueCount} strong />
          <Row label="Public" value={countBy('Public')} />
          <Row label="Private" value={countBy('Private')} />
        </div>

        {/* Tinted, not solid. This page's one red belongs to the lineup that locks first — creating a
            league is a thing you do once a season, not the reason anyone opens the hub on race
            morning. The wash keeps it the loudest control in the rail without spending the page's
            accent (The One Red Rule). */}
        <button
          onClick={() => setCreateOpen(true)}
          className="mt-6 flex h-[46px] w-full items-center justify-center gap-2 rounded-[3px] border border-brand/40 bg-brand/15 font-display text-[16px] font-bold uppercase tracking-[0.05em] text-brand-3 transition-colors hover:border-brand/70 hover:bg-brand/20 cursor-pointer"
        >
          + Create League
        </button>
        <button onClick={() => setJoinOpen(true)} className="mt-[10px] flex h-[42px] w-full items-center justify-center rounded-[3px] border border-line-2 font-display text-[15px] font-semibold uppercase tracking-[0.05em] text-ink-2 transition-colors hover:border-line-3 hover:text-ink cursor-pointer">
          Join with Code
        </button>

        <div className="my-5 h-px bg-line" />
        <div className="mb-[11px] font-display text-[11px] tracking-[0.12em] uppercase text-muted">Race emails</div>
        <EmailPreferenceControls
          prefs={prefsFromList(user.emailPreferences)}
          onChange={(kind, enabled) =>
            updatePref.mutate(
              { kind, enabled },
              { onError: (e) => e instanceof ApiError && e.status === 429 && setRateLimited(true) },
            )
          }
          pending={updatePref.isPending}
        />
        <p className="mt-[8px] font-sans text-[11px] leading-[15px] text-muted">One email each, unsubscribe anytime.</p>
      </aside>

      {/* main */}
      <div className="min-w-0 flex-1 bg-bg">
        <div className="flex flex-wrap items-center gap-x-[11px] gap-y-1 px-4 pb-1 pt-[22px] sm:px-[26px]">
          <h1 className="font-display text-[22px] font-extrabold uppercase text-ink">Your Picks</h1>
          <span className="hidden rounded-[3px] border border-line-2 bg-surface-2 px-[10px] py-[3px] font-sans text-[11px] text-ink-2 sm:inline-block">
            One lineup per championship — scored across all your leagues
          </span>
        </div>

        <div className="flex flex-col gap-3 px-4 py-[10px] sm:px-[26px]">
          {events.isError ? (
            <SectionError
              title="Couldn't load race weekends"
              body="This is a connection problem, not an empty calendar. Any lineup you've already saved is safe."
              onRetry={() => void events.refetch()}
              pending={events.isFetching}
            />
          ) : events.isPending ? (
            <PicksSkeleton />
          ) : picksCards.length === 0 ? (
            <EmptyPicks registered={regs.length > 0} />
          ) : (
            picksCards.map((card) => (
              <PicksCard key={card.eventId} card={card} classById={classById} urgentRoundId={urgentRoundId} />
            ))
          )}
        </div>

        <div className="mx-4 mt-[22px] h-px bg-line sm:mx-[26px]" />

        {/* your leagues */}
        <div className="flex flex-wrap items-center gap-x-[11px] gap-y-1 px-4 pb-[14px] pt-5 sm:px-[26px]">
          <h2 className="font-display text-[22px] font-extrabold uppercase text-ink">Your Leagues</h2>
          <span className="hidden font-sans text-[12px] text-muted sm:inline">Your picks are scored into every league below</span>
        </div>
        {myLeagues.isError ? (
          <div className="mx-4 sm:mx-[26px]">
            <SectionError
              title="Couldn't load your leagues"
              body="This is a connection problem, not an empty league list. You're still a member of everything you joined."
              onRetry={() => void myLeagues.refetch()}
              pending={myLeagues.isFetching}
            />
          </div>
        ) : myLeagues.isPending ? (
          <div className="mx-4 space-y-2 sm:mx-[26px]" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-[4px] border border-line px-4 py-[15px]">
                <div className="h-10 w-10 flex-none rounded-[5px] bg-surface-2" />
                <div className="flex-1 space-y-[6px]">
                  <div className="h-[15px] w-[180px] rounded-[2px] bg-line-2" />
                  <div className="h-[11px] w-[120px] rounded-[2px] bg-line" />
                </div>
                <div className="h-[27px] w-[92px] rounded-[3px] bg-line" />
              </div>
            ))}
          </div>
        ) : leagues.length === 0 ? (
          <div className="mx-4 rounded-[4px] border border-dashed border-line-2 px-5 py-8 text-center font-sans text-[13px] text-muted sm:mx-[26px]">
            You haven't joined any leagues yet — create one or join with a code.
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_110px_100px_110px] items-center border-y border-line px-[26px] py-[10px] font-display text-[11px] tracking-[0.1em] uppercase text-muted sm:grid">
              <span>League</span><span className="text-center">Position</span><span className="text-center">Trend</span><span />
            </div>
            {leagues.map((l) => (
              <LeagueRow key={l.id} league={l} me={user} />
            ))}
          </>
        )}

        <DiscoverLeagues seasonId={primarySeason} />
      </div>

      {primarySeason != null && <CreateLeagueModal seasonId={primarySeason} open={createOpen} onOpenChange={setCreateOpen} />}
      <JoinByCodeModal open={joinOpen} onOpenChange={setJoinOpen} />
      <RateLimitModal open={rateLimited} onOpenChange={setRateLimited} />
      {joinSeasonId != null && (
        <RegisterModal seasonId={joinSeasonId} open onOpenChange={(v) => { if (!v) setJoinSeasonId(null) }} />
      )}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[3px] px-[13px] py-[10px]">
      <span className={strong ? 'text-ink' : 'text-ink-2'}>{label}</span>
      <span className="font-mono text-[12px] text-muted">{value}</span>
    </div>
  )
}

/**
 * A section whose data didn't load.
 *
 * This exists because the alternative is worse than an error: these queries used to resolve to `[]`
 * on failure, so an API outage rendered as a confident, wrong "nothing here". A player opening the
 * hub on race morning was told there was nothing to pick. An empty state is a claim about the world
 * and we may only make it when we actually heard back.
 */
function SectionError({
  title,
  body,
  onRetry,
  pending,
}: {
  title: string
  body: string
  onRetry: () => void
  pending: boolean
}) {
  return (
    <div className="rounded-[4px] border border-danger/40 bg-danger/[0.06] px-5 py-8 text-center">
      <div className="font-display text-[15px] font-bold uppercase tracking-[0.06em] text-ink">{title}</div>
      <p className="mx-auto mt-[6px] max-w-[46ch] font-sans text-[13px] text-muted">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={pending}
        className="mt-4 inline-flex h-9 items-center rounded-[3px] border border-line-2 px-4 font-display text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-2 transition-colors hover:border-line-3 hover:text-ink disabled:text-muted pointer-coarse:h-11 cursor-pointer"
      >
        {pending ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  )
}

/**
 * Loading placeholder shaped like the card it replaces.
 *
 * Not cosmetic. Without a loading branch the section falls straight through to its empty state, so a
 * slow or retrying request renders "No picks to be made" — a confident claim, made before we have
 * heard anything back, that is then replaced by the real content. An empty state must mean "we asked
 * and there is nothing", never "we have not asked yet".
 */
function PicksSkeleton() {
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface" aria-hidden="true">
      <div className="flex items-center gap-3 border-b border-line bg-surface-2/40 px-[15px] py-[10px]">
        <div className="h-[14px] w-[190px] rounded-[2px] bg-line-2" />
        <div className="ml-auto h-[18px] w-[86px] rounded-[3px] bg-line" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col items-stretch border-b border-line last:border-b-0 sm:flex-row">
          <div className="flex-none space-y-[9px] p-[15px] sm:w-[188px]">
            <div className="h-[17px] w-[150px] rounded-[2px] bg-line-2" />
            <div className="h-[12px] w-[110px] rounded-[2px] bg-line" />
            <div className="h-[24px] w-[84px] rounded-[2px] bg-line" />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-1 p-[15px]">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-[46px] w-[196px] rounded-[3px] border border-line-2 bg-surface-2" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Empty state: nothing to pick. Two different reasons, and they are not interchangeable. ----
function EmptyPicks({ registered }: { registered: boolean }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center rounded-[4px] border border-dashed border-line-2 bg-surface/30 px-6 py-14 text-center">
      <span className="font-display text-[15px] font-semibold uppercase tracking-[0.1em] text-muted">
        {registered ? 'No picks to be made' : 'No series joined yet'}
      </span>
      <p className="mt-[7px] max-w-[44ch] font-sans text-[13px] text-muted">
        {registered
          ? 'Every open weekend is picked, and the next one has not been released yet.'
          : 'Join a championship from the list on the left to start building a lineup.'}
      </p>
    </div>
  )
}

// ---- Your-picks card: one weekend (ADR-0008), a row per championship the user is registered in. The
// header badge reflects the live lifecycle status (Picks Open → In Progress at first quali → Scored). ----
function PicksCard({
  card,
  classById,
  urgentRoundId,
}: {
  card: PickCard
  classById: Map<number, ClassDto>
  urgentRoundId: number | null
}) {
  // Tick every second so the badge flips from Picks Open → In Progress exactly at the first round's quali.
  useCountdown(card.firstQuali ?? undefined)
  const status = deriveEventStatus(
    { picksOpen: true, scored: card.scored, finalized: false, rounds: card.firstQuali ? [{ qualiStart: card.firstQuali }] : [] },
    Date.now(),
  )
  const badge = EVENT_STATUS_META[status]
  // Results are in for this weekend, so its rows report points rather than lock state. Taken from
  // the derived status rather than `card.scored` so a row can never disagree with the badge above it.
  const scored = status === 'SCORED'
  // Hairline all round — a thick red left edge is a banned side-stripe, and it was also a third
  // solid red on this view. The weekend is already marked by its header band and status badge.
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface-2/40 px-[15px] py-[10px]">
        <span className="font-display text-[14px] font-bold uppercase tracking-[0.04em] text-ink">{card.eventName}</span>
        {card.eventCircuit && <span className="font-sans text-[12px] text-muted">{card.eventCircuit}</span>}
        <span className={`ml-auto rounded-[3px] border px-[9px] py-[2px] font-mono text-[10px] uppercase tracking-[0.06em] ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-line">
        {card.rows.map((row) => (
          <PicksRow
            key={row.reg.id}
            reg={row.reg}
            round={row.round}
            champName={row.champName}
            scored={scored}
            classById={classById}
            isUrgent={row.round.id === urgentRoundId}
          />
        ))}
      </div>
    </div>
  )
}

/** A pick as this row renders it, whichever endpoint supplied it. `points`/`scores` are scored-only. */
type RowPick = {
  entityType: 'Car' | 'Driver'
  entityId: number
  classId: number
  price: number
  points?: number
  scores?: { source: string; points: number; raceNumber?: null | number }[]
}

// ---- A single championship row within an event card (resolves picks + names for that round). ----
//
// Two endpoints back this row, because a weekend before the flag and a weekend after it are asking
// different questions. Before: the roster GET, whose salary figures answer "can I still afford a
// change?". After: the player-picks GET, which is the only source of what each pick actually scored.
// Both hooks are always called and one is disabled by passing `undefined`, so hook order is stable
// and exactly one request goes out. Should the scored read fail — a `409 not_locked` if an admin
// flags a weekend early — the roster read re-enables and the row degrades to the lineup-only view
// rather than erroring.
function PicksRow({
  reg,
  round,
  champName,
  scored,
  classById,
  isUrgent,
}: {
  reg: Registration
  round: PickRound
  champName: string
  scored: boolean
  classById: Map<number, ClassDto>
  isUrgent: boolean
}) {
  const results = usePlayerPicks(scored ? reg.id : undefined, scored ? round.id : undefined)
  const roster = useRoster(!scored || results.isError ? reg.id : undefined, round.id)
  const prices = usePrices(round.id)
  const cd = useCountdown(round.qualiStart)

  const showResults = scored && !results.isError
  const source = showResults ? results : roster
  const main: RowPick[] = (showResults ? results.data?.main : roster.data?.main) ?? []
  const picks = main.length

  const locked = scored || cd.locked || roster.data?.locked === true
  // A round can be locked and flagged scored before the scoring job has run; its picks come back with
  // no source rows. That must read as "results pending", never as a real zero.
  const totalled = showResults && results.data != null && hasScored(results.data)
  const status = locked ? { t: 'LOCKED', c: 'text-muted' } : picks > 0 ? { t: 'SET', c: 'text-success' } : { t: 'TO DO', c: 'text-warn' }

  // This row owns the page's one solid red only if it is BOTH the soonest to lock and actually
  // unset. Every other to-do row takes the tinted wash the One Red Rule sanctions instead, so the
  // count of solid reds is 1 regardless of how many series the player follows.
  const isPrimary = isUrgent && !locked && picks === 0

  const itemOf = (p: { entityType: string; entityId: number }) =>
    prices.data?.find((x) => x.entityType === p.entityType && x.entityId === p.entityId)

  // Bonus modifiers targeting each pick, keyed by entity (ADR-0006). The scored endpoint's modifier
  // additionally carries the points it contributed, which is the number worth showing; the roster's
  // does not, hence the widened element type rather than a union the `in` operator can't narrow.
  // What the weekend's bonuses added on top of the picks themselves. Untargeted modifiers count too,
  // so this sums the list rather than the per-pick badges.
  const bonusPoints = (results.data?.modifiers ?? []).reduce((sum, m) => sum + m.points, 0)

  const bonusLabel: Record<string, string> = { DOUBLE_POINTS_TEAM: '2×', CAPTAIN: 'C' }
  const rawMods: { kind: string; target: { entityType: string; entityId: number } | null; points?: number }[] =
    (showResults ? results.data?.modifiers : roster.data?.modifiers) ?? []
  const bonusByPick = new Map<string, { label: string; points?: number }>()
  for (const m of rawMods)
    if (m.target)
      bonusByPick.set(`${m.target.entityType}:${m.target.entityId}`, {
        label: bonusLabel[m.kind] ?? '★',
        points: m.points,
      })

  return (
    <div className="flex flex-col items-stretch sm:flex-row">
      <div className="flex-none border-b border-line p-[15px] sm:w-[188px] sm:border-b-0 sm:border-r">
        <div className="flex items-start gap-2">
          {/* Structural mark, not a red spend — the slash goes brand only where it marks the page
              heading or the player's own row, never once per repeated row. */}
          <span className="mt-1 h-[18px] w-[5px] flex-none bg-line-3 [transform:skewX(-14deg)]" />
          <span className="font-display text-[17px] font-bold uppercase leading-tight text-ink">{champName}</span>
        </div>
        <div className="mt-[7px] font-sans text-[12px] text-muted">{round.name}</div>
        <div className="mt-[6px] flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Team</span>
          <span className="truncate font-sans text-[12px] font-medium text-ink-2">{reg.teamName}</span>
        </div>
        {showResults ? (
          // The scored state's headline. A weekend with results in is asking one question, and
          // "LOCKED" was not an answer to it.
          //
          // A round with no lineup gets no figure at all. Its total is a truthful zero, but a bold
          // `0.0` in the slot that holds `1196.0` one row up invites the comparison "did I score
          // nothing, or did something break?" — and `pts pending` would be a straight lie, since the
          // results are in. The row's own "Round missed" is the honest answer, so let it be the only one.
          picks > 0 && (
            <div className="mt-[10px]">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[24px] font-bold leading-none text-ink">
                  {totalled ? fmtTotal(results.data!.total) : '—'}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                  {totalled ? 'pts' : 'pts pending'}
                </span>
              </div>
              {/* Bonus points sit outside every pick's own score, which makes this total the only
                  figure they belong under — and a quarter of a weekend is too much to leave
                  unexplained once it has been taken out of the pick that earned it. */}
              {totalled && bonusPoints > 0 && (
                <div className="mt-[4px] font-mono text-[10px] text-muted">
                  incl. bonus <span className="text-success">{fmtPts(bonusPoints)}</span>
                </div>
              )}
            </div>
          )
        ) : (
          <>
            <div className={`mt-[9px] font-mono text-[11px] font-semibold ${status.c}`}>
              {locked ? 'LOCKED' : picks > 0 ? `LOCKS ${cd.text}` : 'NOT SET'}
            </div>
            {/* Before the flag the meaningful figure is spend, not points — and the roster response
                already carries it, so the budget costs no extra request.
                Headroom against the cap, not spent/cap/left: every figure is rounded to one decimal
                for display, so a real roster (22.75 spent, 2.25 left, 25 cap) prints "$22.8M",
                "$2.3M" and "$25.0M" — three numbers on one line that visibly don't reconcile. Show
                the number a player acts on and the bound it acts against, and there is no sum to
                fail. `muted` is the floor for both (The Contrast Floor Rule). */}
            {!locked && picks > 0 && roster.data && (
              <div className="mt-[6px] font-mono text-[11px] text-muted">
                <span className={roster.data.remaining < 0 ? 'text-danger' : 'text-success'}>
                  {fmtMoney(roster.data.remaining)} left
                </span>{' '}
                of {fmtMoney(roster.data.salaryCap)}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-1 p-[15px]">
        {source.isLoading ? (
          <span className="font-sans text-[13px] text-muted">Loading lineup…</span>
        ) : source.isError ? (
          <span className="flex items-center gap-3 font-sans text-[13px] text-danger">
            Couldn't load this lineup.
            <button
              type="button"
              onClick={() => void source.refetch()}
              className="rounded-[3px] border border-line-2 px-[10px] py-[3px] font-display text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2 transition-colors hover:border-line-3 hover:text-ink cursor-pointer"
            >
              Retry
            </button>
          </span>
        ) : picks > 0 ? (
          main.map((p) => {
            const pi = itemOf(p)
            const badge = bonusByPick.get(`${p.entityType}:${p.entityId}`)
            const cls = classById.get(p.classId)
            const m = classMeta(cls?.name, cls?.color)
            const name = pi?.displayName ?? `#${p.entityId}`
            return (
              <div
                key={`${p.entityType}:${p.entityId}`}
                // A pick is a row, not an object in a box. The bordered `surface-2` chip made this
                // page → card → row → chip: four levels of bordered container, which is the nesting
                // the shared bans call always wrong and which DESIGN.md contradicts by naming the
                // *row* this product's workhorse. The class slash is the left edge now, and reading
                // down a group the slashes line up into the class column they always wanted to be.
                //
                // Full width rather than content-sized, because the points track below only aligns
                // if every pick starts and ends at the same x (The Tabular-Numeral Rule).
                className="flex w-full items-center gap-2 rounded-[3px] py-[5px] pr-1"
              >
                {/* Class identity leads the chip as a broadcast slash, the same mark the pick page
                    and the standings drill-in use. Class is wayfinding; the hub was the one player
                    surface showing a lineup without it. */}
                <span
                  className="h-[26px] w-[3px] flex-none [transform:skewX(-14deg)]"
                  style={{ background: m.hex }}
                  aria-hidden="true"
                />
                <EntityThumb
                  entityType={p.entityType}
                  entityId={p.entityId}
                  roundId={round.id}
                  shape={p.entityType === 'Car' ? 'wide' : 'square'}
                  tintHex={m.hex}
                  className="w-11"
                />
                {/* Takes all the slack, so the points track is pushed to a constant right edge. */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-sans text-[12px] font-medium text-ink-2" title={name}>
                      {name}
                    </span>
                    {badge && (
                      // Teal, not gold: the old `#ffc23d` was GTD PRO's own hue spent on a
                      // non-class meaning. A bonus the player chose, which has now paid out, is
                      // precisely what The Confirmed-Is-Teal Rule describes.
                      <span className="flex h-[16px] flex-none items-center rounded-[2px] border border-success/45 bg-success/15 px-[5px] font-mono text-[10px] font-bold text-success">
                        <span className="sr-only">Bonus applied: </span>
                        {badge.label}
                        <span className="sr-only">{badge.label === '2×' ? ' double points' : ' captain'}</span>
                      </span>
                    )}
                  </div>
                  <DriverLineup drivers={pi?.drivers} variant="compact" className="mt-0.5" />
                  {/* Q/R only. A modifier's points are NOT part of `pick.points` — the API adds them
                      to the round total separately — so listing one here put three figures summing
                      to 660 under a headline of 330. The bonus is reported against the total it
                      actually moved, below. */}
                  {showResults && p.scores && p.scores.length > 0 && (
                    <div className="mt-[3px] flex flex-wrap gap-x-2 font-mono text-[10px] text-muted">
                      {p.scores.map((s) => (
                        <span key={`${s.source}:${s.raceNumber ?? 0}`}>
                          {sourceLabel(s, results.data?.raceCount ?? 1)} {fmtPts(s.points)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {showResults && (
                  // The points track. A fixed width with tabular figures is what makes a column of
                  // totals comparable at a glance — ragged right-alignment was the cost of dropping
                  // the chip's box, and this is the thing that actually pays for it. Wide enough for
                  // four digits and a decimal (`1245.0`), which is more than any single pick scores.
                  <div className="w-[72px] flex-none pl-2 text-right">
                    <div className="font-mono text-[15px] font-bold leading-none text-ink tabular-nums">
                      {p.scores && p.scores.length > 0 ? fmtTotal(p.points ?? 0) : '—'}
                    </div>
                    <div className="mt-[2px] font-mono text-[8px] uppercase tracking-[0.1em] text-muted">pts</div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <span className="font-sans text-[13px] text-muted">
            {locked ? `No lineup was set for ${round.name}.` : `No picks yet for ${round.name}.`}
          </span>
        )}
      </div>

      <div className="flex flex-none items-center border-t border-line p-[15px] sm:border-t-0">
        {picks === 0 && locked ? (
          // Nothing was picked and the round is gone. A button labelled "View Lineup" pointing at a
          // lineup that was never set is a promise the destination can't keep; say what happened.
          // `muted`, not `muted-2`: this is text a player reads, and the ramp below `muted` is
          // decoration only (The Contrast Floor Rule — muted-2 measures 3.03:1 here).
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Round missed</span>
        ) : (
          <Link
            // A scored round's lineup belongs on the results page, which shows what each pick earned
            // and its Q/R breakdown — not on the pick board, which is an editor with nothing to edit.
            to={showResults ? `/standings/team/${reg.id}/round/${round.id}` : `/pick/${round.id}`}
            className={`flex h-[38px] w-full items-center justify-center rounded-[3px] px-[18px] font-display text-[14px] font-semibold uppercase tracking-[0.04em] transition-colors pointer-coarse:h-11 sm:w-auto ${
              isPrimary
                ? 'bg-brand font-bold italic text-ink hover:bg-brand-2'
                : status.t === 'TO DO'
                  ? 'border border-brand/40 bg-brand/15 text-brand-3 hover:border-brand/70 hover:bg-brand/20'
                  : 'border border-line-2 text-ink-2 hover:border-line-3 hover:text-ink'
            }`}
          >
            {showResults ? 'View Results →' : locked ? 'View Lineup' : picks > 0 ? 'Edit Picks' : 'Make Picks →'}
          </Link>
        )}
      </div>
    </div>
  )
}

// ---- Your-leagues row (position from the league leaderboard) ----
function LeagueRow({ league, me }: { league: League; me: Me }) {
  const lb = useLeagueLeaderboard(league.id)
  const myReg = me.registrations.find((r) => r.seasonId === league.seasonId)
  const myRow = lb.data?.entries.find((e) => e.registrationId === myReg?.id)
  const rank = myRow?.rank
  // Real round-over-round movement from the season league board (null until two rounds are scored).
  const trend = myRow?.movement ?? null
  // The board this row summarises already carries the player's points; the row was fetching them and
  // showing only the rank. A position is a comparison — the total is what it's a comparison of.
  const points = myRow?.points
  const initials = league.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  // No entry on the board means no round has scored for this team yet. That is a different thing
  // from "position unknown", and a bare em-dash was letting it read as a bug in the data.
  const unranked = !lb.isLoading && rank == null

  return (
    <>
      {/* sm+ : grid row */}
      <div className="hidden grid-cols-[1fr_110px_100px_110px] items-center border-b border-surface-2 px-[26px] py-[15px] sm:grid">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[5px] border border-line-3 bg-surface-2 font-display text-[15px] font-extrabold text-ink">{initials}</div>
          <div className="min-w-0">
            <div className="truncate font-display text-[17px] font-bold uppercase leading-none text-ink">{league.name}</div>
            <div className="mt-[3px] font-sans text-[11px] text-muted">{league.visibility} · {league.memberCount} players</div>
          </div>
        </div>
        <span className="block text-center">
          <span className="font-mono text-[16px] font-bold text-ink">
            {rank ?? '—'}<span className="text-[11px] text-muted">/{league.memberCount}</span>
          </span>
          <span className="mt-[2px] block font-mono text-[10px] tracking-[0.04em] text-muted">
            {points != null ? `${fmtSeasonPoints(points)} pts` : unranked ? 'Not scored yet' : ''}
          </span>
        </span>
        <span
          aria-label={trend == null ? 'Trend unavailable' : `Trend ${trend > 0 ? `up ${trend}` : trend < 0 ? `down ${-trend}` : 'unchanged'}`}
          className={`block text-center font-mono text-[13px] ${trend != null && trend > 0 ? 'text-success' : trend != null && trend < 0 ? 'text-danger' : 'text-muted'}`}
        >
          {trend == null ? '—' : trend > 0 ? `▲ ${trend}` : trend < 0 ? `▼ ${-trend}` : '— 0'}
        </span>
        <span className="text-right">
          <Link
            to={`/leagues/${league.id}`}
            className="inline-flex min-h-9 items-center rounded-[3px] border border-line-2 px-[14px] font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2 transition-colors hover:border-line-3 hover:text-ink pointer-coarse:min-h-11"
          >
            Standings
          </Link>
        </span>
      </div>

      {/* < sm : card (Trend column dropped for space) */}
      <div className="flex items-center gap-3 border-b border-surface-2 px-4 py-[14px] sm:hidden">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[5px] border border-line-3 bg-surface-2 font-display text-[14px] font-extrabold text-ink">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[16px] font-bold uppercase leading-none text-ink">{league.name}</div>
          <div className="mt-[3px] font-sans text-[11px] text-muted">{league.visibility} · {league.memberCount} players</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-right">
            <span className="font-mono text-[15px] font-bold text-ink">
              {rank ?? '—'}<span className="text-[10px] text-muted">/{league.memberCount}</span>
            </span>
            <span className="mt-[1px] block font-mono text-[10px] text-muted">
              {points != null ? `${fmtSeasonPoints(points)} pts` : unranked ? 'Not scored yet' : ''}
            </span>
          </span>
          <Link
            to={`/leagues/${league.id}`}
            className="inline-flex min-h-9 items-center rounded-[3px] border border-line-2 px-[10px] font-display text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2 pointer-coarse:min-h-11"
          >
            Standings
          </Link>
        </div>
      </div>
    </>
  )
}

// ---- Discover public leagues ----
function DiscoverLeagues({ seasonId }: { seasonId: number | undefined }) {
  const discover = useDiscoverLeagues(seasonId)
  const join = useJoinLeague()
  // Which league the player actually clicked. `join.isPending` alone is a mutation-wide flag, so it
  // disabled every Join button at once and named none of them — five buttons greying out to report
  // one action. Tracking the id lets the pressed button own both the pending and the failed state.
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [failedId, setFailedId] = useState<number | null>(null)

  // The list endpoint reports real membership, so hide leagues we're already in.
  const leagues = discover.data ?? []

  // An empty discover list is genuinely nothing to show — every public league is one the player has
  // already joined — so the section still collapses. A *failed* one is not the same thing, and used
  // to take the identical `return null` path: the section vanished with no trace, which is worse
  // than the empty state it was imitating, because nothing marked that anything was missing.
  if (discover.isError) {
    return (
      <div className="px-4 py-6 sm:px-[26px]">
        <h2 className="mb-[14px] font-display text-[18px] font-extrabold uppercase text-ink">Discover Public Leagues</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[3px] border border-line-2 bg-surface px-[15px] py-[13px]">
          <span className="font-sans text-[13px] text-muted">
            Couldn't load public leagues. Your own leagues above are unaffected.
          </span>
          <button
            type="button"
            onClick={() => void discover.refetch()}
            disabled={discover.isFetching}
            className="inline-flex min-h-9 items-center rounded-[3px] border border-line-2 px-3 font-display text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-2 transition-colors hover:border-line-3 hover:text-ink disabled:text-muted pointer-coarse:min-h-11 cursor-pointer"
          >
            {discover.isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </div>
    )
  }

  if (leagues.length === 0) return null

  return (
    <div className="px-4 py-6 sm:px-[26px]">
      <h2 className="mb-[14px] font-display text-[18px] font-extrabold uppercase text-ink">Discover Public Leagues</h2>
      <div className="flex flex-wrap gap-3">
        {leagues.map((l) => (
          <div
            key={l.id}
            className="flex min-w-0 flex-1 basis-full items-center justify-between gap-4 rounded-[3px] border border-line bg-surface px-[15px] py-[13px] sm:basis-[260px]"
          >
            <div className="min-w-0">
              <div className="truncate font-display text-[15px] font-bold uppercase text-ink">{l.name}</div>
              <div className="font-sans text-[11px] text-muted">{l.memberCount} players · Public</div>
              {failedId === l.id && (
                <div role="alert" className="mt-[3px] font-sans text-[11px] text-danger">
                  Couldn't join — try again.
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setFailedId(null)
                setPendingId(l.id)
                join.mutate(
                  { id: l.id },
                  {
                    // On success the league moves into "Your Leagues" and disappears from this list,
                    // which is the confirmation — no toast needed for a state change you can see.
                    onError: () => setFailedId(l.id),
                    onSettled: () => setPendingId(null),
                  },
                )
              }}
              disabled={pendingId === l.id}
              aria-label={`Join ${l.name}`}
              className="inline-flex min-h-9 flex-none items-center rounded-[3px] border border-line-2 px-3 font-display text-[12px] font-semibold uppercase text-ink transition-colors hover:border-line-3 disabled:text-muted pointer-coarse:min-h-11 cursor-pointer"
            >
              {pendingId === l.id ? 'Joining…' : failedId === l.id ? 'Retry' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
