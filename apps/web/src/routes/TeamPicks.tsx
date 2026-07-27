import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useEvents,
  usePlayerPicks,
  usePrices,
  useRosterRules,
  useRound,
  useRoundLeaderboard,
  useSeasonLeaderboard,
} from '../api/queries'
import { classMeta } from '../lib/classMeta'
import { modMeta } from '../lib/modifierMeta'
import { fmtMoney, fmtPts, fmtTotal, hasScored, makePointsFormat, sourceLabel, sourceLabelLong } from '../lib/scoreFormat'
import { fmtRaceDate } from '../lib/datetime'
import { deriveEventStatus, deriveRoundStatus, EVENT_STATUS_META } from '../lib/eventStatus'
import { lastName } from '../lib/driverName'
import { useAuth } from '../auth/AuthContext'
import type { ShareCardModel, ShareCardPick } from '../lib/shareCard'
import { EntityThumb } from '../components/EntityThumb'
import { DriverLineup } from '../components/DriverLineup'
import { ShareCardButton } from '../components/ShareCardButton'

const key = (p: { entityType: string; entityId: number }) => `${p.entityType}:${p.entityId}`

/**
 * Read-only disclosure of another player's lineup for a scored round, reached by clicking a row on the
 * standings round board. Reuses the pick page's pit-lane look (class rail + cards, EntityThumb/
 * DriverLineup) but swaps the edit controls for the points each pick scored. The API gates this on the
 * round being locked, so a rival's picks can't be copied before lock.
 */
export function TeamPicks() {
  const { registrationId, roundId } = useParams()
  const regId = Number(registrationId)
  const rid = Number(roundId)

  const round = useRound(rid)
  const rules = useRosterRules(rid)
  const prices = usePrices(rid)
  const picks = usePlayerPicks(regId, rid)
  // Season context for the share card's footer. Both are public boards the standings page already
  // caches, and both are optional — if either fails its line simply drops off the card.
  const events = useEvents()
  const roundBoard = useRoundLeaderboard(rid)
  const seasonBoard = useSeasonLeaderboard(round.data?.seasonId)

  // Sharing is limited to your own team. `/auth/me` already carries the signed-in user's
  // registrations (it is fetched at app boot and cached), so ownership is a local comparison rather
  // than another request — the same check the dashboard's league rows already make. Matching on the
  // registration id is exact, so a player registered across six championships needs no season logic.
  //
  // This is a UX gate, not a security boundary, and it is worth being clear about which: the page
  // itself still renders any team's lineup, because GET .../picks has no ownership check by design
  // (that is the opponent-picks feature). It is lock-gated, not owner-gated. Anyone determined to
  // have a rival's card can screenshot the page. What this removes is the app *offering* to make one.
  const { user } = useAuth()
  const isOwnTeam = user?.registrations.some((r) => r.id === regId) ?? false

  // Join picks (entity refs + scores) with the price board for display names + lineups + thumbnails,
  // exactly as the pick page does.
  const priceByKey = useMemo(
    () => new Map((prices.data ?? []).map((p) => [key(p), p])),
    [prices.data],
  )

  // The weekend this round belongs to. Needed for the championship name on the card, and — more
  // importantly — for the `finalized` flag, which lives on the event and has no round-level
  // equivalent. The events list is already cached app-wide by the Landing calendar, so it costs no
  // extra request.
  const event = useMemo(
    () => events.data?.find((e) => e.rounds.some((r) => r.roundId === rid)) ?? null,
    [events.data, rid],
  )
  const champName = event?.rounds.find((r) => r.roundId === rid)?.championshipName ?? null

  const scoredData = picks.data != null && hasScored(picks.data)
  // The page and the share card name the stage from the same derivation, so the pill and the exported
  // image can never disagree about what moment this is. The binary FINAL / AWAITING SCORING this
  // replaces was a fifth dialect, and it could not tell a race still running from one already run.
  //
  // Derived from the EVENT wherever we have one, because that is the object the calendar and the
  // dashboard derive from — deriving from the round alone cannot see `finalized`, and a weekend the
  // calendar calls FINAL would read SCORED here. The round-level fallback covers a round whose event
  // isn't in the list; it can only ever under-report a finalized weekend as scored.
  //
  // Note this asks a different question from `scoredData`, deliberately: the stage is a property of
  // the weekend, while the card variant is a property of *this* roster's data.
  const stage = event
    ? deriveEventStatus(event)
    : round.data
      ? deriveRoundStatus(round.data, scoredData)
      : 'AWAITING'
  const stageMeta = EVENT_STATUS_META[stage]

  const shareModel = useMemo<ShareCardModel | null>(() => {
    // Gated here rather than at the button so a rival's page also skips building the model and the
    // eager canvas render — measured at three renders per page load — instead of doing that work and
    // then declining to show the result. `ShareCardButton` already renders nothing for a null model.
    if (!isOwnTeam) return null
    const data = picks.data
    if (!data || !round.data || data.main.length === 0) return null
    const variant = scoredData ? 'scorecard' : 'lineup'

    // What the card is *about*: after the flag, the pick that delivered; before it, the pick the
    // player staked their modifier on. Same mark, same meaning — "the one I'm betting on".
    // Spelled out, not `C` / `2×`. Those are the page's marks, where the reader is a player and the
    // row is narrow; on the card the reader has never seen the app and the row has width to spare.
    const bonusTargets = new Map(
      data.modifiers
        .filter((m) => m.target)
        .map((m) => [key(m.target!), m.kind === 'CAPTAIN' ? 'CAPTAIN' : '2× POINTS'] as const),
    )
    const bestKey = scoredData
      ? data.main.reduce<{ k: string; p: number } | null>(
          (best, p) => (p.scores.length > 0 && (!best || p.points > best.p) ? { k: key(p), p: p.points } : best),
          null,
        )?.k
      : undefined

    // The card follows the standings board's number rule rather than the page's always-one-decimal
    // one: whole points lose the `.0` and gain a thousands separator, unless anything on the card is
    // fractional, in which case everything keeps one decimal so the column aligns.
    //
    // The decision spans EVERY points value the card prints — the round total, each pick's total,
    // each Q/R contribution and each bonus — because they are read as one set of figures. Deciding
    // per value would print `1,523` above `385.5`, which is the ragged column the rule exists to
    // prevent. Money is untouched: `$34.5M` is a different dialect and always carries its decimal.
    const pf = makePointsFormat([
      data.total,
      ...data.main.flatMap((p) => [p.points, ...p.scores.map((s) => s.points)]),
      ...data.modifiers.map((mo) => mo.points),
    ])

    // Ordered by the round's own class order, so the card reads GTP-down like every board in the app
    // rather than in whatever order the picks were saved.
    const order = new Map((rules.data?.classes ?? []).map((c, i) => [c.classId, i]))
    const ordered = [...data.main].sort(
      (a, b) => (order.get(a.classId) ?? 99) - (order.get(b.classId) ?? 99),
    )

    const cardPicks: ShareCardPick[] = ordered.map((p) => {
      const cls = rules.data?.classes.find((c) => c.classId === p.classId)
      const m = classMeta(cls?.name, cls?.color)
      const info = priceByKey.get(key(p))
      const k = key(p)
      const bonus = bonusTargets.get(k)
      const chips: ShareCardPick['chips'] = []
      if (bonus) chips.push({ text: bonus, tone: 'bonus' })
      if (k === bestKey) chips.push({ text: 'TOP', tone: 'top' })
      return {
        classLabel: m.label,
        classHex: m.hex,
        name: info?.displayName ?? `#${p.entityId}`,
        drivers: (info?.drivers ?? []).map((d) => lastName(d.fullName)),
        figure: scoredData ? (p.scores.length > 0 ? pf.fmt(p.points) : '—') : fmtMoney(p.price),
        breakdown:
          scoredData && p.scores.length > 0
            ? p.scores.map((s) => `${sourceLabelLong(s, data.raceCount)} ${pf.delta(s.points)}`).join('   ')
            : null,
        chips,
        marked: scoredData ? k === bestKey : bonusTargets.has(k),
      }
    })

    // Before the flag the committed number is spend, not points — and it comes straight off the picks,
    // so the lineup card needs no request the page wasn't already making.
    const spend = data.main.reduce((s, p) => s + p.price, 0)
    const cap = rules.data?.salaryCap ?? round.data.salaryCap

    const myRound = roundBoard.data?.entries.find((e) => e.registrationId === regId)
    const mySeason = seasonBoard.data?.entries.find((e) => e.registrationId === regId)

    return {
      variant,
      championship: champName ?? 'Endurance Fantasy',
      roundName: round.data.name,
      // The circuit line becomes the card's "where and when". The date belongs here rather than on
      // the championship line above it, which already needs a 16px step to hold the longest real
      // series-plus-round string and has no room left. `startsAt` is nullable, so fall back to the
      // quali time — a weekend's qualifying is on the same date or the day before, which is close
      // enough for an artifact whose job is to say *which year* this was.
      circuit: [round.data.circuit, fmtRaceDate(round.data.startsAt ?? round.data.qualiStart)]
        .filter(Boolean)
        .join(' · '),
      teamName: data.teamName,
      heroValue: scoredData ? pf.fmt(data.total) : fmtMoney(spend),
      heroUnit: scoredData ? 'PTS' : `OF ${fmtMoney(cap)}`,
      stageLabel: stageMeta.label.toUpperCase(),
      stageHex: stageMeta.hex,
      picks: cardPicks,
      bonuses: data.modifiers.map((mod) => ({
        label: modMeta(mod.kind).label,
        target: mod.target ? (priceByKey.get(key(mod.target))?.displayName ?? null) : null,
        points: scoredData ? pf.delta(mod.points) : null,
      })),
      // Movement is null on single-round boards by design (the API only computes it for cumulative
      // ones), so the round line is rank-only and the season line carries the arrow.
      roundRank: myRound ? { rank: myRound.rank, of: roundBoard.data!.entries.length } : null,
      seasonRank: mySeason ? { rank: mySeason.rank, movement: mySeason.movement ?? null } : null,
      siteUrl: window.location.host,
    }
  }, [
    isOwnTeam,
    picks.data,
    round.data,
    rules.data,
    priceByKey,
    scoredData,
    champName,
    stageMeta,
    roundBoard.data,
    seasonBoard.data,
    regId,
  ])

  const fileSlug = useMemo(
    () =>
      [picks.data?.teamName, round.data?.name]
        .filter(Boolean)
        .join('-')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'round',
    [picks.data?.teamName, round.data?.name],
  )

  if (round.isLoading || rules.isLoading || prices.isLoading || picks.isLoading) {
    return (
      <div className="py-32 text-center font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
        Loading picks…
      </div>
    )
  }

  if (picks.isError) {
    // The lock gate returns a typed 409 { error: 'not_locked' }; everything else is a generic failure.
    const err = picks.error as { error?: string; message?: string } | null
    const notLocked = err?.error === 'not_locked'
    return (
      <div className="mx-auto max-w-[760px] px-4 py-7 sm:px-[26px]">
        <BackLink rid={rid} />
        <div className="mt-6 rounded-[4px] border border-dashed border-line-2 px-5 py-16 text-center">
          <div className="font-display text-[16px] font-bold uppercase text-ink">
            {notLocked ? 'Picks not visible yet' : "Couldn't load picks"}
          </div>
          <div className="mt-2 font-sans text-[13px] text-muted">
            {notLocked
              ? 'A player’s lineup is revealed once qualifying begins for this round.'
              : 'Please go back and try again.'}
          </div>
        </div>
      </div>
    )
  }

  const data = picks.data!
  const classes = rules.data?.classes ?? []
  const picksByClass = new Map<number, typeof data.main>()
  for (const p of data.main) picksByClass.set(p.classId, [...(picksByClass.get(p.classId) ?? []), p])
  const scored = scoredData

  return (
    <div className="mx-auto max-w-[760px] px-4 py-7 sm:px-[26px]">
      <BackLink rid={rid} />

      {/* header band — team + round + total, mirroring the pick page header */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[4px] border border-line bg-surface px-4 py-4 sm:px-5">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <div className="font-display text-[11px] uppercase tracking-[0.12em] text-muted">
            {round.data?.name ?? 'Round'}
          </div>
          <h1 className="font-display text-[26px] font-extrabold uppercase leading-none text-ink [overflow-wrap:anywhere]">
            {data.teamName}
          </h1>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Round points</div>
          <div className="font-mono text-[28px] font-bold leading-none text-ink">
            {scored ? fmtTotal(data.total) : '—'}
          </div>
        </div>
        {/* The lifecycle's own words, uppercased into this surface's dialect. It was a binary
            FINAL / AWAITING SCORING — a fifth vocabulary for a state machine that already has one,
            and one that called a race still running "awaiting scoring". */}
        <div className={`flex items-center gap-[7px] rounded-[3px] border px-3 py-[6px] ${stageMeta.className}`}>
          <span className={`h-[6px] w-[6px] rounded-full ${stageMeta.dotClassName}`} />
          <span className="font-mono text-[12px] font-semibold">{stageMeta.label.toUpperCase()}</span>
        </div>
        {/* Full-width on a phone, inline on the right at `sm`. The band is flex-wrap, so this is the
            fourth item and takes its own row rather than crowding the total. */}
        <ShareCardButton
          model={shareModel}
          fileSlug={fileSlug}
          className="basis-full sm:ml-auto sm:basis-auto"
        />
      </div>

      {/* read-only pit lane */}
      {data.main.length === 0 ? (
        <div className="mt-5 rounded-[4px] border border-dashed border-line-2 px-5 py-16 text-center font-sans text-[13px] text-muted">
          This team didn’t set a lineup for this round.
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {classes.map((c) => {
            const m = classMeta(c.name, c.color)
            const list = picksByClass.get(c.classId) ?? []
            if (list.length === 0) return null
            return (
              <div key={c.classId} className="flex items-stretch gap-3">
                <div className="flex w-[58px] flex-col items-center justify-center gap-1">
                  <span className="font-mono text-[11px] font-bold" style={{ color: m.hex }}>{m.label}</span>
                  <span className="w-[2px] flex-1" style={{ background: m.hex }} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  {list.map((pick) => {
                    const info = priceByKey.get(key(pick))
                    return (
                      <div
                        key={key(pick)}
                        className="flex min-w-0 items-center gap-3 rounded-[4px] border border-line bg-surface-2 px-3 py-3 sm:gap-4 sm:px-4"
                      >
                        {/* Class identity leads the row as a broadcast slash, matching the pick
                            page. It was a 3px colored left border — a banned side-stripe. */}
                        <span
                          className="h-[42px] w-[4px] flex-none [transform:skewX(-14deg)]"
                          style={{ background: m.hex }}
                          aria-hidden="true"
                        />
                        <EntityThumb
                          entityType={pick.entityType}
                          entityId={pick.entityId}
                          roundId={rid}
                          shape={pick.entityType === 'Car' ? 'wide' : 'square'}
                          tintHex={m.hex}
                          className="w-20 sm:w-24"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-[16px] font-bold uppercase leading-[1.15] text-ink [overflow-wrap:anywhere] sm:text-[18px] line-clamp-2">
                            {info?.displayName ?? `#${pick.entityId}`}
                          </div>
                          <DriverLineup drivers={info?.drivers ?? []} className="mt-[7px]" />
                          {/* per-source breakdown — Q / R1 / R2 contributions (API pre-orders them) */}
                          {pick.scores.length > 0 && (
                            <div className="mt-[7px] flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
                              {pick.scores.map((s) => (
                                <span key={`${s.source}:${s.raceNumber ?? 0}`}>
                                  {sourceLabel(s, data.raceCount)} {fmtPts(s.points)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-[18px] font-bold leading-none text-ink">
                            {pick.scores.length > 0 ? fmtTotal(pick.points) : '—'}
                          </div>
                          <div className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.1em] text-muted">pts</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* bonuses applied — read-only, mirroring the pick page's Bonuses panel */}
      {data.modifiers.length > 0 && (
        <div className="mt-5 rounded-[4px] border border-line bg-surface-3 p-4">
          {/* The bolt and the points below were `#ffc23d` — GTD PRO's own amber, spent on something
              that is not a class. Bonuses are `success` teal now: a modifier the player chose, which
              has since paid out, is what The Confirmed-Is-Teal Rule describes, and it leaves the
              class palette meaning only class (The Class-Color Reserve). */}
          <div className="mb-3 flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-success" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
            <span className="font-display text-[15px] font-bold uppercase tracking-[0.04em] text-ink">Bonuses</span>
          </div>
          <div className="flex flex-col gap-2">
            {data.modifiers.map((mod) => {
              const meta = modMeta(mod.kind)
              const target = mod.target ? priceByKey.get(key(mod.target)) : undefined
              return (
                <div
                  key={mod.kind}
                  className="flex items-center justify-between gap-3 rounded-[4px] border border-line-2 bg-surface-2 px-3 py-[10px]"
                >
                  <div className="min-w-0">
                    <div className="font-display text-[13px] font-bold uppercase tracking-[0.03em] text-ink">{meta.label}</div>
                    {target && (
                      <div className="mt-[2px] truncate font-sans text-[12px] text-muted">{target.displayName}</div>
                    )}
                  </div>
                  <div className="shrink-0 font-mono text-[14px] font-bold text-success">
                    {fmtPts(mod.points)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function BackLink({ rid }: { rid: number }) {
  void rid
  return (
    <Link
      to="/standings"
      className="inline-flex items-center gap-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-muted transition-colors hover:text-ink"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m15 18-6-6 6-6" /></svg>
      Standings
    </Link>
  )
}
