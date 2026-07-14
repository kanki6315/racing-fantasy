import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePlayerPicks, usePrices, useRosterRules, useRound } from '../api/queries'
import { classMeta } from '../lib/classMeta'
import { modMeta } from '../lib/modifierMeta'
import { EntityThumb } from '../components/EntityThumb'
import { DriverLineup } from '../components/DriverLineup'

const key = (p: { entityType: string; entityId: number }) => `${p.entityType}:${p.entityId}`

// Per-source short labels for the points breakdown on each pick (MAIN = Quali + Race(s)).
// On a multi-race weekend (raceCount > 1) race scores are numbered R1/R2 by the score's raceNumber.
const srcLabel = (s: { source: string; raceNumber?: number | null }, raceCount: number) => {
  switch (s.source) {
    case 'QualifyingPosition':
      return 'Q'
    case 'RacePosition':
      return raceCount > 1 ? `R${s.raceNumber ?? 1}` : 'R'
    case 'RaceFastestLap':
      return 'FL'
    case 'Bonus':
      return 'B'
    default:
      return s.source
  }
}

const fmtPts = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1))

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

  // Join picks (entity refs + scores) with the price board for display names + lineups + thumbnails,
  // exactly as the pick page does.
  const priceByKey = useMemo(
    () => new Map((prices.data ?? []).map((p) => [key(p), p])),
    [prices.data],
  )

  if (round.isLoading || rules.isLoading || prices.isLoading || picks.isLoading) {
    return (
      <div className="py-32 text-center font-mono text-[12px] uppercase tracking-[0.12em] text-muted-2">
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
  const scored = data.main.some((p) => p.scores.length > 0) || data.total !== 0

  return (
    <div className="mx-auto max-w-[760px] px-4 py-7 sm:px-[26px]">
      <BackLink rid={rid} />

      {/* header band — team + round + total, mirroring the pick page header */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[4px] border border-line bg-surface px-4 py-4 sm:px-5">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <div className="font-display text-[11px] uppercase tracking-[0.12em] text-muted-2">
            {round.data?.name ?? 'Round'}
          </div>
          <h1 className="font-display text-[26px] font-extrabold italic uppercase leading-none text-ink [overflow-wrap:anywhere]">
            {data.teamName}
          </h1>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Round points</div>
          <div className="font-mono text-[28px] font-bold leading-none text-ink">
            {scored ? data.total.toFixed(1) : '—'}
          </div>
        </div>
        <div
          className={`flex items-center gap-[7px] rounded-[3px] border px-3 py-[6px] ${
            scored ? 'border-success/40 bg-success/10' : 'border-line-2'
          }`}
        >
          <span className={`h-[6px] w-[6px] rounded-full ${scored ? 'bg-success' : 'bg-muted-2'}`} />
          <span className={`font-mono text-[12px] font-semibold ${scored ? 'text-success' : 'text-muted-2'}`}>
            {scored ? 'FINAL' : 'AWAITING SCORING'}
          </span>
        </div>
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
                        style={{ borderLeft: `3px solid ${m.hex}` }}
                      >
                        <EntityThumb
                          entityType={pick.entityType}
                          entityId={pick.entityId}
                          roundId={rid}
                          shape={pick.entityType === 'Car' ? 'wide' : 'square'}
                          tintHex={m.hex}
                          className="w-20 sm:w-24"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-display text-[16px] font-bold uppercase text-ink sm:text-[18px]">
                            {info?.displayName ?? `#${pick.entityId}`}
                          </div>
                          <DriverLineup drivers={info?.drivers ?? []} className="mt-[7px]" />
                          {/* per-source breakdown — Q / R1 / R2 contributions (API pre-orders them) */}
                          {pick.scores.length > 0 && (
                            <div className="mt-[7px] flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-2">
                              {pick.scores.map((s) => (
                                <span key={`${s.source}:${s.raceNumber ?? 0}`}>
                                  {srcLabel(s, data.raceCount)} {fmtPts(s.points)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-[18px] font-bold leading-none text-ink">
                            {pick.scores.length > 0 ? pick.points.toFixed(1) : '—'}
                          </div>
                          <div className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">pts</div>
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
          <div className="mb-3 flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#ffc23d"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
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
                  <div className="shrink-0 font-mono text-[14px] font-bold" style={{ color: '#ffc23d' }}>
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
