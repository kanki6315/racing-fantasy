import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  useEvents,
  usePrices,
  useRosterRules,
  useRound,
  useRoster,
  useSaveRoster,
  useSeasonLeaderboard,
  type PriceItem,
  type RosterError,
} from '../api/queries'
import { classMeta } from '../lib/classMeta'
import { modMeta } from '../lib/modifierMeta'
import { useCountdown, useIsLocked } from '../lib/useCountdown'
import { useMediaQuery, SM } from '../lib/useMediaQuery'
import { fmtLockTime, fmtLockTimeLong, fmtRaceDate } from '../lib/datetime'
import { fmtMoney } from '../lib/scoreFormat'
import { deriveEventStatus, deriveRoundStatus, EVENT_STATUS_META } from '../lib/eventStatus'
import { lastName } from '../lib/driverName'
import type { ShareCardModel, ShareCardPick } from '../lib/shareCard'
import { EntityThumb } from '../components/EntityThumb'
import { RegisterModal } from '../components/RegisterModal'
import { DriverLineup } from '../components/DriverLineup'
import { ShareCardButton } from '../components/ShareCardButton'

const key = (p: { entityType: string; entityId: number }) => `${p.entityType}:${p.entityId}`

// Search key: case-folded and stripped of diacritics, so a player typing plain ASCII on a phone
// keyboard still finds the entry. Real entrant and driver names carry them ("Giacomo Altoè" is on
// the live board), and `includes()` on the raw string made those rows unreachable by typing.
const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

type Target = { entityType: 'Car' | 'Driver'; entityId: number }

// Selection-board sort keys, all from fields already on PriceItem. `manufacturer` is intentionally
// absent until the entry-list PDF importer surfaces it on the price board.
type SortKey = 'number' | 'price' | 'name'

// appliesTo values the pick UI can target. MainPick = any roster pick (DOUBLE_POINTS_TEAM, team series);
// Driver = the roster's driver picks (CAPTAIN, driver-based series like MX-5). The series' price board
// determines whether picks are teams or drivers, so each modifier is offered on the series it fits.
const SUPPORTED_APPLIES_TO = new Set(['MainPick', 'Driver'])

export function Pick() {
  const { roundId } = useParams()
  const rid = Number(roundId)
  const { user } = useAuth()
  const round = useRound(rid)
  const rules = useRosterRules(rid)
  const prices = usePrices(rid)

  const registration = user?.registrations.find((r) => r.seasonId === round.data?.seasonId)
  const roster = useRoster(registration?.id, rid)
  const save = useSaveRoster(registration?.id ?? 0, rid)
  // Context for the share card only: the events list names the championship and carries the flags
  // the stage pill derives from, and the season board supplies the "P4 OVERALL" footer line. Both
  // are public boards other screens already cache, and both are optional — if either is missing its
  // line simply drops off the card.
  const events = useEvents()
  const seasonBoard = useSeasonLeaderboard(round.data?.seasonId)

  // Draft roster: the Main picks keyed by entity (entityType:entityId, globally unique) — a class may
  // hold several picks (min..max), so we key by pick, not class — plus selected bonuses; each modifier
  // kind maps to the pick it targets. IMPACT removed (ADR-0006).
  const [main, setMain] = useState<Map<string, PriceItem>>(new Map())
  const [modifiers, setModifiers] = useState<Map<string, Target>>(new Map())
  // Small-screen view toggle: the pit lane and the selection board stack into one column and switch
  // via a segmented control (desktop shows both side by side, so this is ignored at lg+).
  const [mobileTab, setMobileTab] = useState<'lineup' | 'board'>('lineup')
  // Class filter for the selection board, lifted here so an empty pit-lane slot can drive it: clicking
  // an "Add a … pick" prompt focuses the board on that class (and, on mobile, flips to the board tab).
  const [classFilter, setClassFilter] = useState<number | null>(null)
  // Register-first screen's modal — registers for THIS round's season in place (no navigation), so
  // the board appears as soon as /auth/me refetches with the new registration.
  const [registerOpen, setRegisterOpen] = useState(false)
  const focusClass = (classId: number) => {
    setClassFilter(classId)
    setMobileTab('board')
  }

  // Seed the draft from the saved roster once both it and the price board (for display names) load.
  useEffect(() => {
    if (!roster.data || !prices.data) return
    const pm = new Map(prices.data.map((p) => [key(p), p]))
    const m = new Map<string, PriceItem>()
    for (const pk of roster.data.main) {
      const it = pm.get(key(pk))
      if (it) m.set(key(it), it)
    }
    setMain(m)
    const mm = new Map<string, Target>()
    for (const mod of roster.data.modifiers ?? []) {
      if (mod.target) mm.set(mod.kind, { entityType: mod.target.entityType as Target['entityType'], entityId: mod.target.entityId })
    }
    setModifiers(mm)
  }, [roster.data, prices.data])

  // Does the draft differ from what's actually saved? Compared as sorted key sets so pick order
  // never registers as a change.
  const savedSignature = useMemo(() => {
    if (!roster.data) return null
    const picks = roster.data.main.map(key).sort().join('|')
    const mods = (roster.data.modifiers ?? [])
      .filter((m) => m.target)
      .map((m) => `${m.kind}@${m.target!.entityType}:${m.target!.entityId}`)
      .sort()
      .join('|')
    return `${picks}//${mods}`
  }, [roster.data])

  const lockAt = round.data?.qualiStart
  // The boolean only, so this component re-renders when the lock lands — not once a second. The
  // ticking text lives in <LockPill>, which owns the countdown itself.
  const lockedByTime = useIsLocked(lockAt)
  // The event's board hasn't been released yet → not pickable, distinct from quali-locked. Folded into
  // `locked` so every control disables; the status pill + error copy below tell the two apart.
  const notOpen = roster.data?.picksOpen === false
  const locked = lockedByTime || roster.data?.locked === true || notOpen

  const cap = rules.data?.salaryCap ?? round.data?.salaryCap ?? 0
  const selected = useMemo(() => [...main.values()], [main])
  const spent = selected.reduce((s, p) => s + p.price, 0)
  const remaining = cap - spent

  // A bonus is only real while the pick it points at is still in the roster. Deriving that instead
  // of imperatively pruning `modifiers` on every add/remove means a bonus can never outlive its
  // target, whatever order the state updates land in — the save path already filtered this way, so
  // display and submission now agree by construction rather than by two pieces of code agreeing.
  const mainKeys = useMemo(() => new Set(selected.map(key)), [selected])
  const effectiveModifiers = useMemo(() => {
    const n = new Map<string, Target>()
    for (const [k, t] of modifiers) if (mainKeys.has(key(t))) n.set(k, t)
    return n
  }, [modifiers, mainKeys])

  // Bonus rules the pick UI can currently fulfil (car-targeted). Drives the Bonuses selectors + pill.
  const modifierRules = (rules.data?.modifiers ?? []).filter((m) => SUPPORTED_APPLIES_TO.has(m.appliesTo))

  // Warn before a reload or tab close throws away an unsaved lineup. The draft lives only in
  // component state, so a mis-tap at the lock deadline silently costs the whole roster. Guarded on
  // `locked` too — once picks are locked the draft can't be saved anyway and the prompt is noise.
  const draftSignature = useMemo(() => {
    const picks = selected.map(key).sort().join('|')
    const mods = [...effectiveModifiers.entries()]
      .map(([kind, t]) => `${kind}@${key(t)}`)
      .sort()
      .join('|')
    return `${picks}//${mods}`
  }, [selected, effectiveModifiers])
  const isDirty = savedSignature !== null && draftSignature !== savedSignature && !locked

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const composition = (rules.data?.classes ?? []).map((c) => {
    const have = selected.filter((p) => p.classId === c.classId).length
    return { ...c, have, ok: have >= c.min && have <= c.max }
  })
  const compositionOk = composition.every((c) => c.ok)
  // `composition.length > 0` is the guard against a round whose roster rules haven't been authored:
  // `[].every()` is true, so an unconfigured round handed the player a live SAVE LINEUP over an
  // empty pit lane. A round with no rules has nothing to validate a lineup against.
  const hasRules = composition.length > 0
  const canSave = !locked && hasRules && compositionOk && remaining >= 0 && !save.isPending

  // The one thing standing between the player and a saved lineup, in the order they'd hit it. The
  // Save button used to just go dead: `canSave` knew the reason and the screen never said it, and
  // the typed server errors below can't cover for that — the button disables before a request can
  // fail, so `cap_exceeded`/`composition` never render. Sits beside the action at every width.
  // Every branch names an action the player can take, not a state they're in — "Too many GTD PRO
  // picks" described the problem and left them to work out the move. The wording matches the empty
  // slot prompts ("Add a GTP pick") and the save errors below, so the screen says one thing one way.
  const blockedReason = (() => {
    if (notOpen) return "Picks for this event aren't open yet"
    if (locked) return 'Picks are locked'
    if (!hasRules) return 'This round has no roster rules yet'
    if (remaining < 0) return `${fmtMoney(Math.abs(remaining))} over the cap — drop or swap a pick`
    const excess = composition.find((c) => c.have > c.max)
    if (excess) return `Remove a ${classMeta(excess.name, excess.color).label} pick`
    const missing = composition.find((c) => c.have < c.min)
    if (missing) return `Add a ${classMeta(missing.name, missing.color).label} pick`
    return null
  })()

  // The pre-lock share card (the social ask: fans want to post their picks before the race, not
  // just their score after it). Built from the DRAFT — the lineup on screen — not the saved roster,
  // because the card must show what the player is looking at when they hit Share; a stale saved
  // lineup under a fresh edit would be the one genuinely surprising output. Always the `lineup`
  // variant: this page never has scores, and the scored card already ships from the standings
  // drill-in. Null while the pit lane is empty, which keeps the button out of the DOM entirely.
  const shareEvent = useMemo(
    () => events.data?.find((e) => e.rounds.some((r) => r.roundId === rid)) ?? null,
    [events.data, rid],
  )
  const champName = shareEvent?.rounds.find((r) => r.roundId === rid)?.championshipName ?? null
  // Same precedence as everywhere else: the event derivation when the weekend is in the cached
  // list, the round-level fallback otherwise. Pre-lock this lands on OPEN, so the card's pill says
  // PICKS OPEN — a card shared before qualifying should read as an entry, not a result.
  const stage = shareEvent
    ? deriveEventStatus(shareEvent)
    : round.data
      ? deriveRoundStatus(round.data, false)
      : 'OPEN'
  const stageMeta = EVENT_STATUS_META[stage]

  const shareModel = useMemo<ShareCardModel | null>(() => {
    if (!round.data || !registration || selected.length === 0) return null

    const bonusTargets = new Map(
      [...effectiveModifiers.entries()].map(
        ([kind, t]) => [key(t), kind === 'CAPTAIN' ? 'CAPTAIN' : '2× POINTS'] as const,
      ),
    )

    // Ordered by the round's own class order, so the card reads GTP-down like every board in the
    // app rather than in whatever order the picks were clicked.
    const order = new Map((rules.data?.classes ?? []).map((c, i) => [c.classId, i]))
    const ordered = [...selected].sort(
      (a, b) => (order.get(a.classId) ?? 99) - (order.get(b.classId) ?? 99),
    )

    const cardPicks: ShareCardPick[] = ordered.map((p) => {
      const cls = rules.data?.classes.find((c) => c.classId === p.classId)
      const m = classMeta(cls?.name, cls?.color)
      const bonus = bonusTargets.get(key(p))
      return {
        classLabel: m.label,
        classHex: m.hex,
        name: p.displayName ?? `#${p.entityId}`,
        drivers: (p.drivers ?? []).map((d) => lastName(d.fullName)),
        figure: fmtMoney(p.price),
        price: null,
        breakdown: null,
        chips: bonus ? [{ text: bonus, tone: 'bonus' }] : [],
        marked: bonus != null,
      }
    })

    const bonuses = [...effectiveModifiers.entries()].map(([kind, t]) => ({
      label: modMeta(kind).label,
      target: main.get(key(t))?.displayName ?? null,
      points: null,
    }))

    const mySeason = seasonBoard.data?.entries.find((e) => e.registrationId === registration.id)

    return {
      variant: 'lineup',
      championship: champName ?? 'Endurance Fantasy',
      roundName: round.data.name,
      circuit: [round.data.circuit, fmtRaceDate(round.data.startsAt ?? round.data.qualiStart)]
        .filter(Boolean)
        .join(' · '),
      teamName: registration.teamName,
      heroValue: fmtMoney(spent),
      heroUnit: `OF ${fmtMoney(cap)}`,
      spend: null,
      stageLabel: stageMeta.label.toUpperCase(),
      stageHex: stageMeta.hex,
      picks: cardPicks,
      bonuses,
      // No round rank before the round has run; the season line alone carries the footer.
      roundRank: null,
      seasonRank: mySeason ? { rank: mySeason.rank, movement: mySeason.movement ?? null } : null,
      siteUrl: window.location.host,
    }
  }, [
    round.data,
    registration,
    selected,
    effectiveModifiers,
    main,
    rules.data,
    champName,
    stageMeta,
    seasonBoard.data,
    spent,
    cap,
  ])

  const fileSlug = useMemo(
    () =>
      [registration?.teamName, round.data?.name]
        .filter(Boolean)
        .join('-')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'round',
    [registration?.teamName, round.data?.name],
  )

  const maxForClass = (classId: number) =>
    (rules.data?.classes ?? []).find((c) => c.classId === classId)?.max ?? 1

  // Clicking a board pick toggles it. A class holds up to `max` picks; when the class is full a
  // single-slot class (max 1) swaps the existing pick, while a multi-slot class blocks until one is
  // removed (so the user explicitly drops a pick before adding another).
  //
  // The capacity check reads `prev` inside the updater, never the derived `selected`. Against
  // `selected` — a useMemo over `main` — several clicks landing in one React commit all saw the
  // same pre-commit snapshot, so three fast taps put three picks in a max-1 class ("GTP 3/1") and
  // the lineup sat in a state the rules forbid until the player unpicked by hand.
  const addPick = (item: PriceItem) => {
    if (locked) return
    const k = key(item)
    setMain((prev) => {
      if (prev.has(k)) {
        const n = new Map(prev)
        n.delete(k)
        return n
      }
      const inClass = [...prev.values()].filter((p) => p.classId === item.classId)
      const max = maxForClass(item.classId)
      if (inClass.length >= max) {
        if (max !== 1) return prev // multi-slot class full — remove one first
        const n = new Map(prev)
        n.delete(key(inClass[0])) // single slot: swap
        return n.set(k, item)
      }
      return new Map(prev).set(k, item)
    })
  }
  const removePick = (item: PriceItem) => {
    if (locked) return
    setMain((prev) => {
      const n = new Map(prev)
      n.delete(key(item))
      return n
    })
  }
  const toggleModifier = (kind: string, item: PriceItem) => {
    if (locked) return
    setModifiers((prev) => {
      const next = new Map(prev)
      const cur = next.get(kind)
      if (cur && cur.entityType === item.entityType && cur.entityId === item.entityId) next.delete(kind)
      else next.set(kind, { entityType: item.entityType, entityId: item.entityId })
      return next
    })
  }

  const onSave = () => {
    save.mutate({
      main: selected.map((c) => ({ entityType: c.entityType, entityId: c.entityId })),
      modifiers: [...effectiveModifiers.entries()].map(([kind, t]) => ({
        kind,
        target: { entityType: t.entityType, entityId: t.entityId },
        params: null,
      })),
    })
  }

  if (!user) return null
  if (round.isLoading || rules.isLoading || prices.isLoading) {
    return <div className="py-32 text-center font-mono text-[12px] uppercase tracking-[0.12em] text-muted">Loading board…</div>
  }
  if (round.isError || rules.isError || prices.isError) {
    const retrying = round.isFetching || rules.isFetching || prices.isFetching
    return (
      <div className="mx-4 my-12 flex flex-col items-center gap-4 rounded-[4px] border border-danger/30 bg-danger/[0.06] px-5 py-12 text-center sm:mx-[26px]">
        {/* One noun for this surface everywhere: the loading line, this error, and the panel heading
            all call it the board. It was "the selection board" here and "board" one branch up. */}
        <p className="font-sans text-[13px] text-danger">Couldn’t load the board.</p>
        {/* A retry, not "refresh the page" — three cached queries and a session are thrown away to
            recover from one failed request, and on a phone mid-deadline that's the wrong trade. */}
        <button
          type="button"
          disabled={retrying}
          onClick={() => {
            void round.refetch()
            void rules.refetch()
            void prices.refetch()
          }}
          className="flex min-h-9 items-center rounded-[3px] border border-line-2 px-4 py-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-2 transition-colors hover:border-line-3 hover:text-ink disabled:cursor-not-allowed disabled:text-muted pointer-coarse:min-h-11"
        >
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    )
  }
  // An admin creates a round before pricing it, and the pick-release gate lives on the *event*, so
  // an unpriced board is reachable the moment a weekend opens. It used to render an empty pit lane,
  // a board headed "Drivers ·0" (guessed from absent data), the line "No null drivers on this
  // board.", and a live red SAVE LINEUP over a lineup that cannot exist.
  if (round.data && (prices.data?.length ?? 0) === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-32 text-center">
        <h1 className="font-display text-[22px] font-bold uppercase text-ink">Board not up yet</h1>
        <p className="max-w-[46ch] font-sans text-[13px] text-muted">
          Prices for {round.data.name} haven’t been published. You’ll be able to build a lineup here
          as soon as they are{lockAt ? `, and picks lock ${fmtLockTimeLong(lockAt)}` : ''}.
        </p>
        <Link
          to="/"
          className="mt-2 flex min-h-11 items-center rounded-[3px] border border-line-2 px-5 font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2 transition-colors hover:border-line-3 hover:text-ink"
        >
          Back to the calendar
        </Link>
      </div>
    )
  }
  if (round.data && registration == null) {
    return (
      <div className="flex flex-col items-center gap-3 py-32 text-center">
        <h1 className="font-display text-[22px] font-bold uppercase text-ink">Register first</h1>
        <p className="max-w-[42ch] font-sans text-[13px] text-muted">
          {/* Lead with the SERIES — event names are shared across every series racing the weekend,
              so naming only the event can't tell the player which championship they're missing. */}
          {champName
            ? `You need to register for ${champName} before you can set a lineup for the "${round.data.name}".`
            : `You need to register for this season before you can set a lineup for the "${round.data.name}".`}
        </p>
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="mt-2 flex h-11 cursor-pointer items-center rounded-[3px] bg-brand px-5 font-display text-[14px] font-bold uppercase text-ink transition-colors hover:bg-brand-2"
        >
          Claim your team
        </button>
        <RegisterModal
          seasonId={round.data.seasonId}
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          confirmLabel="Confirm & Set Lineup"
          // Stay on this round — the /auth/me refetch surfaces the new registration and the board
          // replaces this screen, instead of the default bounce to the dashboard.
          onRegistered={() => {}}
        />
      </div>
    )
  }

  const err = save.error as RosterError | null
  const classNameById = new Map((rules.data?.classes ?? []).map((c) => [c.classId, c.name]))

  const saveButton = (className: string) => (
    <button
      type="button"
      disabled={!canSave}
      onClick={onSave}
      className={`rounded-[3px] font-display font-bold italic uppercase tracking-[0.05em] text-ink ${
        canSave ? 'bg-brand cursor-pointer hover:bg-brand-2 transition-colors' : 'bg-[#3a1614] opacity-60 cursor-not-allowed'
      } ${className}`}
    >
      {save.isPending ? 'Saving…' : 'Save Lineup'}
    </button>
  )

  return (
    // Two scroll models, deliberately. At lg+ this is a fixed-height workspace: the header holds
    // still and each column scrolls itself, so the cap, the pills and Save can never leave the
    // screen while the player is picking. Below lg the page scrolls normally (touch expects that,
    // and only one panel is visible at a time) and the chrome is pinned with `sticky` instead —
    // status at the top, the action in the thumb zone at the bottom.
    <div className="flex flex-col lg:h-full lg:overflow-hidden">
      {/* Pinned chrome: status band + save feedback + view toggle move as one block on mobile. */}
      <div className="sticky top-0 z-30 shrink-0 border-b border-line bg-surface lg:static lg:z-auto">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 short:gap-y-1 short:py-1 sm:px-[26px] lg:gap-x-6 lg:py-3">
          {/* Subject and deadline pair up on one mobile row — the two things that identify the
              screen without changing much. `lg:contents` dissolves this wrapper at desktop so both
              rejoin the band's own flex row, where `order` puts them back at opposite ends. */}
          {/* `contents` at lg — and again on a short viewport, where a landscape phone is wide
              enough for one row and can't spare the second one's 34px. */}
          <div className="flex w-full items-center justify-between gap-3 short:contents lg:contents">
            {/* The round name is the page's subject, so it leads at lg — it used to be an 11px
                muted label with the salary cap (a constant that never moves all weekend) set 20px
                bold beneath it, which inverted the hierarchy onto the least live number on the
                screen. The cap now appears exactly once, in the budget group where it's read. */}
            <h1 className="min-w-0 flex-1 truncate font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-muted short:order-1 short:max-w-[170px] short:flex-none lg:order-1 lg:max-w-[280px] lg:flex-none lg:text-[17px] lg:font-bold lg:tracking-[0.02em] lg:text-ink">
              {round.data?.name}
            </h1>

            {/* Lock state, and the primary action at lg. Below lg Save lives in the bottom bar. */}
            <div className="flex shrink-0 items-center gap-3 short:order-3 short:ml-auto lg:order-3 lg:ml-auto">
              <LockPill notOpen={notOpen} locked={locked} lockAt={lockAt} />
              <div className="hidden items-center gap-3 lg:flex">
                {blockedReason && !save.isPending && (
                  <span className="max-w-[140px] text-right font-sans text-[12px] leading-tight text-warn xl:max-w-[180px]">
                    {blockedReason}
                  </span>
                )}
                {saveButton('min-h-11 px-6 py-2 text-[15px]')}
              </div>
            </div>
          </div>

          {/* Budget + requirements share one row on mobile and scroll sideways together (the app's
              filter-row idiom) rather than wrapping into the ~150px stack that used to push real
              content past the fold. At lg they're ordinary flex items again. */}
          {/* The mask makes the sideways overflow legible as overflow rather than a pill sliced off
              at the viewport edge. It costs nothing when the row fits — the faded zone is then
              empty — so it needs no overflow measurement to stay honest. */}
          {/* No `lg:flex-1`. Greedy, this row measured 946px at 1280 and shoved the 490px lock+save
              group onto a second line — the band doubled to 128px and the primary action detached
              from its own title on exactly the laptop widths most players use. Sized to content it
              shares the row down to ~1150px, and the `flex-wrap` parent still handles narrower. */}
          <div className="flex w-full min-w-0 items-center gap-3 overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] short:order-2 short:w-auto short:flex-1 lg:order-2 lg:w-auto lg:flex-none lg:overflow-visible lg:[mask-image:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* The "spent of cap" half is hidden on a phone for room, which left the figure beside
                it reading as a bare "$0.5M left" with nothing to measure against. The group states
                the whole sum once, so the label doesn't depend on which half is on screen. */}
            <div
              className="flex shrink-0 items-center gap-2 lg:block lg:w-[260px]"
              aria-label={`Budget: ${fmtMoney(spent)} spent of a ${fmtMoney(cap)} cap, ${
                remaining < 0 ? `${fmtMoney(Math.abs(remaining))} over` : `${fmtMoney(remaining)} left`
              }`}
            >
              <div className="lg:mb-1 lg:flex lg:items-baseline lg:justify-between lg:gap-3">
                <span aria-hidden="true" className="hidden font-sans text-[12px] text-muted lg:inline">
                  Spent {fmtMoney(spent)} of {fmtMoney(cap)}
                </span>
                <span
                  aria-hidden="true"
                  className={`font-mono text-[13px] font-bold whitespace-nowrap ${
                    remaining < 0 ? 'text-danger' : 'text-success'
                  }`}
                >
                  {/* "$-3.0M left" was a raw float through a template — nobody has negative three
                      million left. Over-cap gets its own sentence. */}
                  {remaining < 0 ? `${fmtMoney(Math.abs(remaining))} over` : `${fmtMoney(remaining)} left`}
                </span>
              </div>
              <div className="h-[6px] w-[52px] shrink-0 overflow-hidden rounded-full bg-line lg:h-2 lg:w-full">
                <div
                  className="h-full transition-[width] duration-200 ease-out motion-reduce:transition-none"
                  style={{
                    width: `${Math.min(100, Math.max(0, (spent / (cap || 1)) * 100))}%`,
                    // The bar agrees with the "$X left" label beside it: teal in budget, danger over.
                    // It used to be a permanent red gradient, which both spent a third red on every
                    // pick session and read as a warning when spending the full cap is the goal.
                    background: remaining < 0 ? 'var(--color-danger)' : 'var(--color-success)',
                  }}
                />
              </div>
            </div>

            <span className="h-8 w-px shrink-0 bg-line-2 lg:hidden" aria-hidden="true" />

            {/* requirement pills */}
            {composition.map((c) => {
              const m = classMeta(c.name, c.color)
              // "1/3" on a satisfied min-1/max-3 class reads as unfinished — the numerals alone
              // can't say whether the denominator is a requirement or a ceiling, and colour is the
              // only other cue. Spell the state out for the label so it never rests on hue.
              const state = c.have < c.min
                ? `need ${c.min - c.have} more`
                : c.have > c.max
                  ? `${c.have - c.max} too many`
                  : 'complete'
              const range = c.min === c.max ? `${c.min}` : `${c.min}–${c.max}`
              return (
                <div
                  key={c.classId}
                  // aria-label only — a `title` saying the same thing gets announced twice by some
                  // screen readers and never fires on touch at all.
                  aria-label={`${m.label}: ${c.have} picked of ${range}, ${state}`}
                  // One line on mobile so the pinned status strip stays ~30px; stacked at lg where
                  // the band has the height to spare and the column reads faster.
                  className="flex shrink-0 items-center gap-1.5 rounded-[3px] border px-[10px] py-[4px] lg:flex-col lg:gap-[2px] lg:py-[5px]"
                  // Unmet class slots sit on the line-3 hairline (the token), not an off-palette gray;
                  // over-max borrows the warn hue so "too many" and "none yet" stop sharing chrome.
                  style={{
                    borderColor: c.ok ? m.hex : c.have > c.max ? 'var(--color-warn)' : '#3a3f47',
                    background: c.ok ? `${m.hex}1a` : c.have > c.max ? 'rgba(255,158,44,.1)' : 'transparent',
                  }}
                >
                  <span className="font-mono text-[10px] font-semibold" style={{ color: m.hex }}>{m.label}</span>
                  <span className={`font-mono text-[11px] ${c.ok ? 'text-ink' : 'text-warn'}`}>{c.have}/{c.max}</span>
                </div>
              )
            })}
            {modifierRules.length > 0 && (
              <>
                {/* The bonus is free upside, not a fifth requirement. A divider and a quieter label
                    stop it reading as an unmet slot in a row of mandatory ones. */}
                <span className="h-8 w-px shrink-0 bg-line-2" aria-hidden="true" />
                <div
                  // Teal, not `#ffc23d`. That hex is `gtdpro-2`, GTD PRO's own amber, spent on
                  // something that is not a racing class — a straight Class-Color Reserve breach. A
                  // bonus the player has assigned is a state they have achieved, which DESIGN.md's
                  // Confirmed-Is-Teal Rule now covers explicitly.
                  className={`flex shrink-0 items-center gap-1.5 rounded-[3px] border px-[10px] py-[4px] lg:flex-col lg:gap-[2px] lg:py-[5px] ${
                    effectiveModifiers.size > 0 ? 'border-success/45 bg-success/10' : 'border-line-2'
                  }`}
                >
                  <span className="font-mono text-[10px] font-semibold text-muted">BONUS</span>
                  <span className="font-mono text-[11px] text-ink-2">{effectiveModifiers.size}/{modifierRules.length}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* The roster, spoken. Everything this screen shows about the lineup — how many picks, what
            it costs, what's still blocking the save — was visible and unannounced, so a screen
            reader user built a lineup in silence. Permanently mounted and `polite`: a live region
            inserted at the same moment its text appears is unreliably announced, and this text
            changes on every pick, which is exactly when it should be heard. */}
        <p aria-live="polite" className="sr-only">
          {selected.length} {selected.length === 1 ? 'pick' : 'picks'},{' '}
          {remaining < 0 ? `${fmtMoney(Math.abs(remaining))} over the cap` : `${fmtMoney(remaining)} left`}
          {blockedReason ? `. ${blockedReason}` : '. Lineup ready to save'}
        </p>

        {/* save feedback */}
        {/* Saving isn't the end of the round — players don't know the lineup stays editable, and a
            bare "Lineup saved." leaves them wondering whether they're committed. */}
        {/* Mounted whether or not there's a message, for the same reason as above. */}
        <div role="status">
          {save.isSuccess && (
            <div className="border-t border-line bg-success/10 px-4 py-2 font-sans text-[13px] text-success sm:px-[26px]">
              Lineup saved. You can keep changing it until picks lock.
            </div>
          )}
        </div>
        {/* These fire when the server disagrees with the client — a lock that lands mid-save, or a
            board that changed under the player. Each says what happened to the lineup they just
            tried to save and what to do next; "composition is invalid" named a database table.

            The client owns the wording for every kind it knows. Two branches used to fall back to
            `err.message`, so the same banner spoke the API's voice ("Picks are locked; qualifying
            has begun.") or the product's depending on which error fired — and the API's version
            can't answer the question actually being asked at that moment, which is what happened to
            the lineup. `err.message` still shows for a kind we haven't got copy for. */}
        {/* `alert`, not `status`: a save that didn't land is time-critical against a lock, and the
            player needs to hear it before they walk away believing they're in. */}
        <div role="alert">
          {err && (
          <div className="border-t border-line bg-danger/10 px-4 py-2 font-sans text-[13px] text-danger sm:px-[26px]">
            {err.error === 'locked'
              ? "Picks locked before this saved — your lineup wasn’t changed."
              : err.error === 'not_open'
                ? "Picks for this event aren’t open yet, so nothing was saved."
                : err.error === 'cap_exceeded'
                  ? `${fmtMoney(spent - cap)} over the cap — drop or swap a pick, then save again.`
                  : err.error === 'composition'
                    ? 'Your lineup doesn’t meet the class requirements — check the slots above.'
                    : err.error === 'modifier'
                      ? 'That bonus can’t go to that pick any more — choose another, then save again.'
                      : err.error === 'unavailable'
                        ? 'Some of your picks are no longer on the board — pick again, then save.'
                        : (err.message ?? 'Couldn’t save your lineup. Try again.')}
          </div>
          )}
        </div>

        {/* mobile view toggle — desktop shows both panels side by side, so this is hidden at lg+ */}
        <div className="flex gap-1 border-t border-line px-4 py-2 short:py-1 lg:hidden">
          {(['lineup', 'board'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              aria-pressed={mobileTab === tab}
              // Same selected-state language as the standings filters: border + fill + ink, with the
              // nav's 2px brand underline. A view toggle is navigation, not the primary action.
              className={`h-11 flex-1 rounded-[3px] font-display text-[12px] font-bold uppercase tracking-[0.06em] transition-colors ${
                mobileTab === tab
                  ? 'border border-line-3 bg-surface-2 text-ink shadow-[inset_0_-2px_0_0_var(--color-brand)]'
                  : 'border border-line-2 bg-surface-2 text-muted'
              }`}
            >
              {tab === 'lineup' ? 'Your Lineup' : 'Add Picks'}
            </button>
          ))}
        </div>
      </div>

      {/* The workspace. `min-h-0` is what lets the columns own their overflow at lg instead of
          growing the page — without it the children stretch the flex row and the board's
          `overflow-y-auto` silently resolves to no scroll container at all. */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* min-w-0 lets the pit lane shrink instead of forcing the 560px board off-screen — a long
            entrant name ("#4 Corvette Racing by Pratt Miller Motorsports") used to push the page
            into horizontal scroll at laptop widths. */}
        <div
          className={`${mobileTab === 'lineup' ? 'block' : 'hidden'} min-w-0 flex-1 lg:block lg:h-full lg:overflow-y-auto`}
        >
          <PitLane
            classes={rules.data?.classes ?? []}
            main={main}
            roundId={rid}
            locked={locked}
            onRemovePick={removePick}
            onFocusClass={focusClass}
            modifierRules={modifierRules}
            modifiers={effectiveModifiers}
            mainPicks={selected}
            onToggleModifier={toggleModifier}
            footer={
              <ShareCardButton
                model={shareModel}
                fileSlug={fileSlug}
                className="mt-6"
              />
            }
          />
        </div>
        <div
          className={`${
            mobileTab === 'board' ? 'block' : 'hidden'
          } w-full border-line lg:block lg:h-full lg:w-[560px] lg:flex-none lg:border-l xl:w-[600px]`}
        >
          <SelectionPanel
            prices={prices.data ?? []}
            classList={rules.data?.classes ?? []}
            classNameById={classNameById}
            mainSelected={main}
            roundId={rid}
            locked={locked}
            onAddPick={addPick}
            classFilter={classFilter}
            setClassFilter={setClassFilter}
          />
        </div>
      </div>

      {/* Mobile action bar. The lock is a real deadline and Save used to sit at the very top of a
          ~4,000px page — from the end of the board it was nearly 3,000px out of reach. Here it's
          pinned in the thumb zone with the reason it's unavailable printed directly above it. */}
      <div
        className="sticky bottom-0 z-30 shrink-0 border-t border-line bg-surface px-4 pt-2 short:pt-1 lg:hidden"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {blockedReason && !save.isPending && (
          <div className="pb-2 text-center font-sans text-[12px] text-warn short:pb-1">{blockedReason}</div>
        )}
        {saveButton('min-h-12 w-full py-2 text-[16px] short:min-h-11')}
      </div>
    </div>
  )
}

/**
 * The lock state, and the only thing on this screen that changes every second.
 *
 * It owns `useCountdown` so the tick re-renders these few nodes instead of the whole roster builder.
 * The parent asks `useIsLocked` for the boolean, which only re-renders it when the lock actually
 * lands — the countdown used to drive a ~1,250-node reconcile once a second to change one string.
 *
 * A countdown says how long and never when, so the wall-clock moment rides the pill's accessible
 * name at every width and prints beneath it where there's room, matching the Landing hero.
 */
function LockPill({ notOpen, locked, lockAt }: { notOpen: boolean; locked: boolean; lockAt?: string }) {
  const cd = useCountdown(lockAt)
  return (
    <div className="flex flex-col items-end gap-[2px]">
      <div
        className={`flex items-center gap-[7px] rounded-[3px] border px-2.5 py-[5px] lg:px-3 lg:py-[6px] ${
          notOpen ? 'border-line-2 bg-surface-2' : locked ? 'border-line-2 bg-surface-2' : 'border-line-2'
        }`}
        aria-label={
          notOpen
            ? "Picks for this event aren't open yet"
            : locked
              ? 'Picks are locked'
              : lockAt
                ? `Picks lock in ${cd.text}, ${fmtLockTimeLong(lockAt)}`
                : `Picks lock in ${cd.text}`
        }
      >
        <span
          className={`h-[6px] w-[6px] shrink-0 rounded-full ${
            notOpen ? 'bg-muted-2' : locked ? 'bg-muted' : 'bg-brand [animation:blink_1.4s_infinite]'
          }`}
          aria-hidden="true"
        />
        <span
          aria-hidden="true"
          className={`font-mono text-[11px] font-semibold whitespace-nowrap lg:text-[12px] ${
            notOpen ? 'text-muted' : locked ? 'text-muted' : 'text-brand-3'
          }`}
        >
          {notOpen ? 'PICKS NOT OPEN' : locked ? 'LOCKED' : `LOCKS ${cd.text}`}
        </span>
      </div>
      {!notOpen && !locked && lockAt && (
        <span aria-hidden="true" className="hidden font-mono text-[10px] tracking-[0.06em] text-muted xl:block">
          {fmtLockTime(lockAt)}
        </span>
      )}
    </div>
  )
}

// ---- Pit lane (your picks) ----
function PitLane({
  classes,
  main,
  roundId,
  locked,
  onRemovePick,
  onFocusClass,
  modifierRules,
  modifiers,
  mainPicks,
  onToggleModifier,
  footer,
}: {
  classes: { classId: number; name: string | null; color?: string | null; min: number; max: number }[]
  main: Map<string, PriceItem>
  roundId: number
  locked: boolean
  onRemovePick: (item: PriceItem) => void
  onFocusClass: (classId: number) => void
  modifierRules: { kind: string; maxCount: number; appliesTo: string }[]
  modifiers: Map<string, Target>
  mainPicks: PriceItem[]
  onToggleModifier: (kind: string, item: PriceItem) => void
  /** Rendered inside the lane's measure, after the bonuses panel — the share action lives here so it
   *  sits with the lineup it exports rather than in the already-crowded status band. */
  footer?: ReactNode
}) {
  // The pick row was designed for the 560px desktop column and reused verbatim on a phone, where
  // the stacked driver chips pushed it to ~168px — 2.6 of them fit an iPhone SE, so the tab whose
  // whole job is "what have I got?" couldn't show a four-pick lineup. Below `sm` the drivers take
  // the board's compact treatment (avatar stack + one surname line) and share that line with the
  // price. Branching in JS rather than rendering both: the two shapes differ structurally, and this
  // is the hook DESIGN.md prescribes for exactly that.
  const isSm = useMediaQuery(SM)
  const picksByClass = new Map<number, PriceItem[]>()
  for (const p of main.values()) picksByClass.set(p.classId, [...(picksByClass.get(p.classId) ?? []), p])
  return (
    // min-h-full, not flex-1: inside the lg scroll container the gradient has to cover the column
    // even when a one-class series leaves the content short. The inner cap keeps the lane from
    // sprawling to 880px at desktop widths — a pick row reads better at a measure, not a banner.
    <div className="min-h-full bg-gradient-to-b from-[#15171a] to-[#0d0f11] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[760px]">
      <h2 className="mb-3 font-display text-[12px] uppercase tracking-[0.14em] text-muted">Your Pit Lane</h2>
      <div className="flex flex-col gap-3">
        {classes.map((c) => {
          const m = classMeta(c.name, c.color)
          const picks = picksByClass.get(c.classId) ?? []
          // Show every filled pick plus enough empty slots to reach the class max (at least one prompt
          // when the class is empty), so a multi-pick class makes all its open slots visible.
          const emptySlots = Math.max(c.max - picks.length, picks.length === 0 ? 1 : 0)
          return (
            <div key={c.classId} className="flex items-stretch gap-2 sm:gap-3">
              {/* 58px of class rail is a sixth of a 375px screen. 48 + a 10px label keeps the
                  longest name ("GTD PRO") on one line — at 44 it broke across two and left that
                  one rail taller than its neighbours. */}
              <div className="flex w-12 flex-col items-center justify-center gap-1 sm:w-[58px]">
                <span
                  className="whitespace-nowrap font-mono text-[10px] font-bold sm:text-[11px]"
                  style={{ color: m.hex }}
                >
                  {m.label}
                </span>
                {c.max > 1 && <span className="font-mono text-[9px] text-muted">{picks.length}/{c.max}</span>}
                <span className="w-[2px] flex-1" style={{ background: m.hex }} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {picks.map((pick) => (
                  <div
                    key={key(pick)}
                    className="flex min-w-0 items-center gap-2.5 rounded-[4px] border border-line bg-surface-2 px-2.5 py-3 sm:gap-4 sm:px-4"
                  >
                    {/* Class identity leads the row as a broadcast slash. It used to be a 3px colored
                        left border — a side-stripe, which the system bans outright. */}
                    <span
                      className="h-[42px] w-[4px] flex-none [transform:skewX(-14deg)]"
                      style={{ background: m.hex }}
                      aria-hidden="true"
                    />
                    <EntityThumb
                      entityType={pick.entityType}
                      entityId={pick.entityId}
                      roundId={roundId}
                      shape={pick.entityType === 'Car' ? 'wide' : 'square'}
                      tintHex={m.hex}
                      className="w-14 sm:w-24"
                    />
                    <div className="min-w-0 flex-1">
                      {/* Wrap to two lines rather than truncate: on a phone the column is narrow
                          enough that "#4 Corvette Racing by Pratt Miller Motorsports" cut off after
                          a few characters, and the entrant name is what the player is scanning for. */}
                      <div className="font-display text-[16px] font-bold uppercase leading-[1.15] text-ink [overflow-wrap:anywhere] sm:text-[18px] line-clamp-2">
                        {pick.displayName}
                      </div>
                      {/* One line on a phone (drivers beside the price), two at sm+ where there's
                          room for the full chips. */}
                      <div className="mt-1 flex min-w-0 items-center justify-between gap-2 sm:mt-[7px] sm:block">
                        <DriverLineup drivers={pick.drivers} variant={isSm ? 'full' : 'compact'} />
                        <span className="shrink-0 font-mono text-[13px] text-ink-2 sm:mt-[7px] sm:block">
                          {fmtMoney(pick.price)}
                        </span>
                      </div>
                    </div>
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => onRemovePick(pick)}
                        className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-3 bg-surface cursor-pointer transition-colors hover:border-line-2 before:absolute before:inset-[-8px] before:content-['']"
                        aria-label={`Remove ${pick.displayName}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={m.hex} strokeWidth="2.4"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <button
                    key={`empty-${i}`}
                    type="button"
                    disabled={locked}
                    onClick={() => onFocusClass(c.classId)}
                    className={`flex w-full items-center gap-3 rounded-[4px] border border-dashed border-line-3 px-4 py-5 text-left text-muted ${locked ? 'cursor-not-allowed' : 'cursor-pointer hover:border-line-2'}`}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={m.hex} strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
                    <span className="font-display text-[15px] font-bold uppercase" style={{ color: m.hex }}>Add a {m.label} pick</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* bonuses — a selector per available bonus rule (ADR-0006). Pick which team gets the bonus. */}
      {modifierRules.length > 0 && (
        <div className="mt-6 rounded-[4px] border border-line bg-surface-3 p-4">
          <div className="mb-1 flex items-baseline gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="translate-y-[2px] text-success" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
            </svg>
            <h2 className="font-display text-[15px] font-bold uppercase tracking-[0.04em] text-ink">Bonuses</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">Optional</span>
          </div>
          {/* Rules separate with rules, not with boxes. Each one used to be a bordered, filled panel
              inside this bordered, filled panel — a card in a card, which the system bans outright. */}
          <div className="flex flex-col divide-y divide-line-2">
            {modifierRules.map((rule) => {
              const meta = modMeta(rule.kind)
              const eligible = rule.appliesTo === 'Driver' ? mainPicks.filter((p) => p.entityType === 'Driver') : mainPicks
              const target = modifiers.get(rule.kind)
              return (
                <div key={rule.kind} className="py-4 first:pt-3 last:pb-0">
                  <div className="font-display text-[14px] font-bold uppercase tracking-[0.03em] text-ink">{meta.label}</div>
                  {meta.hint && <div className="mt-[2px] font-sans text-[12px] text-muted">{meta.hint}</div>}
                  {eligible.length === 0 ? (
                    <div className="mt-2 font-sans text-[12px] text-muted">
                      Pick a {rule.appliesTo === 'Driver' ? 'driver' : 'team'} first to assign this bonus.
                    </div>
                  ) : (
                    <div className="mt-[10px] flex flex-wrap gap-2">
                      {eligible.map((p) => {
                        const sel = !!target && target.entityType === p.entityType && target.entityId === p.entityId
                        return (
                          <button
                            key={key(p)}
                            type="button"
                            disabled={locked}
                            onClick={() => onToggleModifier(rule.kind, p)}
                            aria-pressed={sel}
                            className={`flex min-h-9 items-center py-1.5 rounded-[3px] border px-3 font-display text-[12px] font-semibold uppercase tracking-[0.03em] transition-colors pointer-coarse:min-h-11 ${
                              locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                            } ${sel ? 'border-success/50 bg-success/15 text-ink' : 'border-line-3 text-muted'}`}
                          >
                            {p.displayName}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {footer}
      </div>
    </div>
  )
}

// ---- Selection panel ----
// One pick type per series, driven by the round's price board: teams (cars) for a team series like
// WeatherTech, drivers for a driver-based series like the MX-5 Cup. Each class slot holds one entry.
function SelectionPanel({
  prices,
  classList,
  classNameById,
  mainSelected,
  roundId,
  locked,
  onAddPick,
  classFilter,
  setClassFilter,
}: {
  prices: PriceItem[]
  classList: { classId: number; name: string | null; color?: string | null }[]
  classNameById: Map<number, string | null>
  mainSelected: Map<string, PriceItem>
  roundId: number
  locked: boolean
  onAddPick: (item: PriceItem) => void
  classFilter: number | null
  setClassFilter: (classId: number | null) => void
}) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  // Board sort. `null` = the series default (number for team series, price-desc for driver series),
  // resolved each render so it survives the prices-still-loading first paint. Manufacturer is a
  // planned future key once the entry-list importer surfaces it on PriceItem.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)

  const q = fold(search.trim())
  // Team series if the board has cars; otherwise a driver-based series (MX-5 Cup) picks drivers.
  const cars = prices.filter((p) => p.entityType === 'Car')
  const teamBased = cars.length > 0
  const pool = teamBased ? cars : prices.filter((p) => p.entityType === 'Driver')
  const heading = teamBased ? 'Teams' : 'Drivers'
  // Show a per-row class badge only when the series actually runs multiple classes (ADR — a one-make
  // cup wouldn't need it). Drives both the badge and whether the flat list interleaves classes.
  const multiClass = classList.length > 1
  const classColorById = new Map(classList.map((c) => [c.classId, c.color]))

  // Drivers have no race number, so that key only exists for team series; the default sorts cars by
  // number (numeric-aware so "#04" < "#7") and driver series by price, high to low.
  const sortOptions: { key: SortKey; label: string }[] = [
    ...(teamBased ? [{ key: 'number' as const, label: 'Number' }] : []),
    { key: 'price' as const, label: 'Price' },
    { key: 'name' as const, label: 'Name' },
  ]
  const activeSort = sort ?? (teamBased ? { key: 'number' as const, dir: 1 as const } : { key: 'price' as const, dir: -1 as const })
  // Clicking the active key flips direction; switching key picks that key's natural default direction
  // (number/name ascending, price descending — most expensive first).
  const onSort = (key: SortKey) =>
    setSort((cur) => {
      const eff = cur ?? activeSort
      if (eff.key === key) return { key, dir: eff.dir === 1 ? -1 : 1 }
      return { key, dir: key === 'price' ? -1 : 1 }
    })
  // Car display names bake in the race number ("#31 Cadillac Whelen"), so a name sort strips that
  // leading "#<num> " token to order by the actual team/driver name (a no-op for unprefixed names).
  const sortName = (p: PriceItem) => (p.displayName ?? '').replace(/^#\S+\s+/, '')
  const compare = (a: PriceItem, b: PriceItem) => {
    let r: number
    if (activeSort.key === 'price') r = a.price - b.price
    else if (activeSort.key === 'name') r = sortName(a).localeCompare(sortName(b))
    else r = (a.number ?? '').localeCompare(b.number ?? '', undefined, { numeric: true })
    return r * activeSort.dir
  }

  const list = pool
    .filter((p) => !q || fold(p.displayName ?? '').includes(q))
    .sort(compare)
    .filter((p) => classFilter === null || p.classId === classFilter)
  const filtered = q !== '' || classFilter !== null
  const noun = teamBased ? 'teams' : 'drivers'
  const filterLabel = classFilter === null ? null : classMeta(classNameById.get(classFilter)).label

  return (
    // h-full at lg so the panel's own chrome (heading, search, filters) can hold still while only
    // the list scrolls. Below lg the panel sits in normal page flow and grows to its content.
    <div className="flex w-full flex-col bg-surface-3 lg:h-full">
      <div className="flex h-[46px] shrink-0 items-center border-b border-line px-4">
        <h2 className="flex items-center gap-[6px] font-display text-[15px] font-bold uppercase tracking-[0.04em] text-ink">
          {heading}
          {/* The count answers "how many can I choose from", so it has to follow the filters. It
              printed the full board's size while the list below showed eleven rows. */}
          <span className="font-mono text-[11px] text-muted">
            {filtered ? `·${list.length} of ${pool.length}` : `·${pool.length}`}
          </span>
        </h2>
      </div>

      <div className="flex shrink-0 flex-col gap-[10px] px-4 pt-[14px] pb-[10px]">
        <div className="flex h-[38px] items-center gap-[9px] rounded-[3px] border border-line-2 bg-surface-2 px-[13px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a8f98" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={teamBased ? 'Search teams…' : 'Search drivers…'}
            aria-label={teamBased ? 'Search teams' : 'Search drivers'}
            className="w-full bg-transparent font-sans text-[13px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="flex flex-wrap gap-[7px]">
          {[null, ...classList.map((c) => c.classId)].map((cid) => {
            const active = classFilter === cid
            const label = cid === null ? 'All' : classMeta(classNameById.get(cid)).label
            return (
              <button
                key={cid ?? 'all'}
                type="button"
                onClick={() => setClassFilter(cid)}
                aria-pressed={active}
                // Same selected-state language as every other filter in the app: 3px corners (never
                // pill-rounded), border + fill shift, brand only as the 2px underline. Sized off the
                // pointer, not the viewport — these were a flat 32px, so every touch device got a
                // target a third under the minimum on the app's most mobile screen.
                className={`flex min-h-9 items-center py-1.5 rounded-[3px] border px-3 font-display text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors cursor-pointer pointer-coarse:min-h-11 ${
                  active
                    ? 'border-line-3 bg-surface-2 text-ink shadow-[inset_0_-2px_0_0_var(--color-brand)]'
                    : 'border-line-2 text-muted hover:text-ink-2'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-[7px]">
          <span className="font-display text-[11px] uppercase tracking-[0.1em] text-muted">Sort</span>
          {sortOptions.map((opt) => {
            const active = activeSort.key === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onSort(opt.key)}
                aria-label={`Sort by ${opt.label}${active ? (activeSort.dir === 1 ? ', ascending' : ', descending') : ''}`}
                aria-pressed={active}
                className={`flex min-h-9 items-center py-1.5 gap-1 rounded-[3px] border px-3 font-display text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors cursor-pointer pointer-coarse:min-h-11 ${
                  active
                    ? 'border-line-3 bg-surface-2 text-ink shadow-[inset_0_-2px_0_0_var(--color-brand)]'
                    : 'border-line-2 text-muted hover:text-ink-2'
                }`}
              >
                {opt.label}
                {active && <span className="font-mono text-[10px] leading-none">{activeSort.dir === 1 ? '↑' : '↓'}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {/* A search with no hits used to render an empty panel — no message, no way back, just the
            board apparently gone. Name what was searched, then hand back the control that undoes it. */}
        {list.length === 0 && (
          <div className="flex flex-col items-start gap-3 px-4 py-10">
            <p className="font-sans text-[13px] text-ink-2">
              {/* Both axes are independently optional. The old shape assumed a class filter was
                  active whenever there was no query and printed "No null drivers on this board." */}
              {q
                ? filterLabel
                  ? `No ${filterLabel} ${noun} match “${search.trim()}”.`
                  : `No ${noun} match “${search.trim()}”.`
                : filterLabel
                  ? `No ${filterLabel} ${noun} on this board.`
                  : `No ${noun} on this board.`}
            </p>
            <button
              type="button"
              onClick={() => {
                // Focus first, synchronously. This button unmounts the moment the list repopulates,
                // which dropped focus to <body> and dumped a keyboard user at the top of the
                // document. Moving focus to the input that owns the state we're clearing has to
                // happen before the unmount — deferring it to rAF looked fine and silently did
                // nothing whenever the tab wasn't in the foreground, which is when a backgrounded
                // player returns to their lineup.
                searchRef.current?.focus()
                setSearch('')
                setClassFilter(null)
              }}
              className="flex min-h-9 items-center py-1.5 rounded-[3px] border border-line-2 px-3 font-display text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-2 transition-colors cursor-pointer hover:border-line-3 hover:text-ink pointer-coarse:min-h-11"
            >
              Show all {noun}
            </button>
          </div>
        )}
        {list
          .map((p) => {
            const selected = mainSelected.has(key(p))
            const cm = classMeta(classNameById.get(p.classId), classColorById.get(p.classId))
            return (
              <div
                key={key(p)}
                className="flex items-center gap-3 border-b border-line px-4 py-[10px] transition-colors hover:bg-surface-2"
              >
                <EntityThumb
                  entityType={p.entityType}
                  entityId={p.entityId}
                  roundId={roundId}
                  shape={p.entityType === 'Car' ? 'wide' : 'square'}
                  tintHex={cm.hex}
                  className="w-12 sm:w-14"
                />
                <div className="min-w-0 flex-1">
                  {/* The badge takes its own line on a phone and gives the name the column's full
                      width; inline beside it once the panel is wide enough to afford both. */}
                  <div className="flex flex-wrap items-start gap-x-2 gap-y-[3px]">
                    {multiClass && (
                      <span
                        className="shrink-0 rounded-[3px] border px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-[0.04em] sm:mt-[2px]"
                        style={{ color: cm.hex, borderColor: `${cm.hex}66`, background: `${cm.hex}1a` }}
                      >
                        {cm.label}
                      </span>
                    )}
                    {/* Wrap to two lines rather than truncate — the same call the pit lane already
                        made. Hard-truncating cut "#3 Corvette Racing by Pratt Miller Motorsports"
                        to 34% of itself in a 119px box, leaving it identical to the #4 entry
                        directly above it; the entrant name is the thing being chosen. */}
                    <span className="w-full font-display text-[15px] font-bold uppercase leading-[1.2] text-ink [overflow-wrap:anywhere] line-clamp-2 sm:w-auto sm:min-w-0 sm:flex-1">
                      {p.displayName}
                    </span>
                  </div>
                  <DriverLineup drivers={p.drivers} variant="compact" className="mt-[3px]" />
                </div>
                <div className="shrink-0 font-mono text-[14px] font-bold text-ink">{fmtMoney(p.price)}</div>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onAddPick(p)}
                  // 28px is the mark; the tap target is 44px via an inset pseudo-element, so the
                  // most-repeated control on the screen stops being a third under the minimum
                  // without growing the row 54 times over.
                  className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors before:absolute before:inset-[-8px] before:content-[''] ${
                    // In-lineup is a CONFIRMED state, so it takes success teal, not brand red.
                    // One red per screen belongs to SAVE ROSTER — with a red dot on every picked
                    // row, a full lineup put five reds on screen and the real action stopped
                    // standing out. The − / + icons keep the state readable without color.
                    selected ? 'bg-success' : 'border border-line-3 bg-surface'
                  } ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label={selected ? `Remove ${p.displayName}` : `Add ${p.displayName}`}
                >
                  {selected ? (
                    // Dark glyph on the light teal fill — white on #2dd4bf reads about 1.9:1.
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0a0b0d" strokeWidth="2.8"><path d="M5 12h14" /></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8ccd2" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
                  )}
                </button>
              </div>
            )
          })}
      </div>
    </div>
  )
}
