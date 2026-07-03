import { useMemo, useState } from 'react'
import { useAdmin } from '../../admin/AdminContext'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { PrimaryButton, ClassSwatch, EmptyState } from '../../admin/ui'
import { Demo } from '../../components/Demo'
import { useCarEntries, useAdminClasses, useSavePrices, useEntryDrivers, useDrivers } from '../../api/adminQueries'
import { usePrices } from '../../api/queries'
import { classMeta } from '../../lib/classMeta'
import { mockPickPct } from '../../lib/demoStats'

/** Which entity type this series prices (ADR-0012): teams price cars, driver series (MX-5) price drivers. */
type Mode = 'Car' | 'Driver'

type Row = {
  entityType: Mode
  entityId: number
  number: string | null // race number (a driver row shows its car's number)
  label: string // team name or driver full name
  classId: number
  className: string
  original: number | null // saved price, or null if unpriced
  lastRound: number | null
}

const rowKey = (r: { entityType: Mode; entityId: number }) => `${r.entityType}:${r.entityId}`

export function Prices() {
  const { roundId, round, seasonId, championshipId, rounds } = useAdmin()
  const { data: cars = [] } = useCarEntries(seasonId)
  const { data: classes = [] } = useAdminClasses(championshipId)
  const { data: prices = [] } = usePrices(roundId ?? 0)
  const { data: entryDrivers = [] } = useEntryDrivers()
  const { data: allDrivers = [] } = useDrivers()

  // Previous round (sequence − 1) gives a real last-round price + delta — no mock needed.
  const prevRound = useMemo(() => {
    if (!round) return undefined
    return rounds.find((r) => r.sequence === round.sequence - 1)
  }, [rounds, round])
  const { data: prevPrices = [] } = usePrices(prevRound?.id ?? 0)

  // Teams | Drivers mode. Defaults from the board itself (same rule as the player Pick page):
  // driver prices with no car prices ⇒ a driver-based series. The toggle overrides per visit.
  const [modeOverride, setModeOverride] = useState<Mode | null>(null)
  const inferredMode: Mode =
    prices.some((p) => p.entityType === 'Driver') && !prices.some((p) => p.entityType === 'Car') ? 'Driver' : 'Car'
  const mode = modeOverride ?? inferredMode

  // edits: rowKey -> raw input string. Absent ⇒ untouched (shows the saved value).
  const [edits, setEdits] = useState<Record<string, string>>({})
  const save = useSavePrices(roundId ?? 0)

  const priceByKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of prices) m.set(`${p.entityType}:${p.entityId}`, p.price)
    return m
  }, [prices])
  const lastByKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of prevPrices) m.set(`${p.entityType}:${p.entityId}`, p.price)
    return m
  }, [prevPrices])

  const className = (id: number) => classes.find((c) => c.id === id)?.name ?? `#${id}`
  const classColor = (id: number) => classes.find((c) => c.id === id)?.color

  const carRows: Row[] = useMemo(
    () =>
      cars.map((c) => ({
        entityType: 'Car' as const,
        entityId: c.id,
        number: c.number,
        label: c.teamName,
        classId: c.classId,
        className: className(c.classId),
        original: priceByKey.get(`Car:${c.id}`) ?? null,
        lastRound: lastByKey.get(`Car:${c.id}`) ?? null,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cars, priceByKey, lastByKey, classes],
  )

  // Driver rows: the season's lineups, car by car. Round-scoped lineup rows win over season-wide
  // ones (ADR-0011); a driver sharing two cars appears once, under the first car that lists them.
  const driverRows: Row[] = useMemo(() => {
    const carById = new Map(cars.map((c) => [c.id, c]))
    const nameById = new Map(allDrivers.map((d) => [d.id, d.fullName]))
    const byCar = new Map<number, typeof entryDrivers>()
    for (const ed of entryDrivers) {
      if (!carById.has(ed.carEntryId)) continue
      const list = byCar.get(ed.carEntryId)
      if (list) list.push(ed)
      else byCar.set(ed.carEntryId, [ed])
    }
    const rows: Row[] = []
    const seen = new Set<number>()
    for (const car of cars) {
      const list = byCar.get(car.id) ?? []
      const roundRows = list.filter((ed) => ed.roundId === roundId)
      const chosen = (roundRows.length ? roundRows : list.filter((ed) => ed.roundId == null)).sort(
        (a, b) => (a.slotOrder ?? a.id) - (b.slotOrder ?? b.id),
      )
      for (const ed of chosen) {
        if (seen.has(ed.driverId)) continue
        seen.add(ed.driverId)
        rows.push({
          entityType: 'Driver',
          entityId: ed.driverId,
          number: car.number,
          label: nameById.get(ed.driverId) ?? `#${ed.driverId}`,
          classId: car.classId,
          className: className(car.classId),
          original: priceByKey.get(`Driver:${ed.driverId}`) ?? null,
          lastRound: lastByKey.get(`Driver:${ed.driverId}`) ?? null,
        })
      }
    }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars, entryDrivers, allDrivers, roundId, priceByKey, lastByKey, classes])

  const rows = mode === 'Car' ? carRows : driverRows

  // The current value for a row: an edit if present, else the saved price.
  const valueOf = (r: Row): string => edits[rowKey(r)] ?? (r.original != null ? String(r.original) : '')
  const numOf = (r: Row): number | null => {
    const v = valueOf(r).trim()
    if (v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const isDirty = (r: Row): boolean => {
    if (!(rowKey(r) in edits)) return false
    const n = numOf(r)
    return n !== r.original
  }
  const isInvalid = (r: Row): boolean => {
    const v = valueOf(r).trim()
    if (v === '') return false
    const n = Number(v)
    return !Number.isFinite(n) || n < 0
  }

  const dirtyRows = rows.filter(isDirty)
  const invalidCount = rows.filter(isInvalid).length
  const pricedCount = rows.filter((r) => numOf(r) != null).length

  const onSave = async () => {
    const payload = rows
      .map((r) => ({ r, n: numOf(r) }))
      .filter((x) => x.n != null && !isInvalid(x.r))
      .map((x) => ({ entityType: x.r.entityType, entityId: x.r.entityId, classId: x.r.classId, price: x.n! }))
    if (payload.length === 0) return
    await save.mutateAsync(payload)
    setEdits({})
  }

  if (!roundId || !round) return <EmptyState>Select a round in the topbar</EmptyState>

  const byClass = classes.filter((cl) => rows.some((r) => r.classId === cl.id))
  const noun = mode === 'Car' ? 'Team' : 'Driver'

  return (
    <>
      <AdminPageHeader
        title="Price Board"
        subtitle={`RD ${String(round.sequence).padStart(2, '0')} · ${round.circuit ?? round.name} — set what players spend against the cap.`}
        actions={
          <PrimaryButton onClick={onSave} disabled={dirtyRows.length === 0 || invalidCount > 0 || save.isPending}>
            {save.isPending ? 'Saving…' : `Save All${dirtyRows.length ? ` · ${dirtyRows.length}` : ''}`}
          </PrimaryButton>
        }
      />

      {/* Stats bar */}
      <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[6px] border border-line bg-surface px-5 py-3">
        <div
          className="flex overflow-hidden rounded-[4px] border border-line-2"
          role="radiogroup"
          aria-label="Priced entity type"
        >
          {(['Car', 'Driver'] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => setModeOverride(m)}
              className={`px-3 py-[6px] font-mono text-[10px] uppercase tracking-[0.08em] ${
                mode === m ? 'bg-brand/15 text-brand' : 'text-muted hover:text-ink-2'
              }`}
            >
              {m === 'Car' ? 'Teams' : 'Drivers'}
            </button>
          ))}
        </div>
        <Stat label="Salary Cap" value={`$${round.salaryCap.toFixed(1)}M`} />
        <Stat label="Priced" value={`${pricedCount}/${rows.length}`} />
        <Stat
          label="Unsaved"
          value={
            dirtyRows.length ? (
              <span className="flex items-center gap-[6px] text-warn">
                <span className="h-[6px] w-[6px] rounded-full bg-warn [animation:blink_1.4s_ease-in-out_infinite]" />
                {dirtyRows.length}
              </span>
            ) : (
              <span className="text-muted">0</span>
            )
          }
        />
        {invalidCount > 0 && <Stat label="Errors" value={<span className="text-danger">{invalidCount}</span>} />}
        {prevRound && (
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-2">
            Δ vs RD {String(prevRound.sequence).padStart(2, '0')}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState>
          {mode === 'Car'
            ? 'No car entries for this season — import entries first'
            : 'No drivers for this season — import an entry list first'}
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {byClass.map((cl) => {
            const classRows = rows.filter((r) => r.classId === cl.id)
            const priced = classRows.map(numOf).filter((n): n is number => n != null)
            const avg = priced.length ? priced.reduce((a, b) => a + b, 0) / priced.length : null
            return (
              <div key={cl.id} className="overflow-hidden rounded-[6px] border border-line bg-surface">
                <div className="flex items-center gap-2 border-b border-line px-4 py-2">
                  <ClassSwatch hex={classMeta(cl.name, cl.color).hex} />
                  <span className="font-display text-[13px] font-semibold uppercase text-ink">{cl.name}</span>
                  <span className="font-mono text-[10px] text-muted-2">
                    {classRows.length} {mode === 'Car' ? 'cars' : 'drivers'}
                  </span>
                  {avg != null && (
                    <span className="ml-auto font-mono text-[10px] text-muted">avg ${avg.toFixed(1)}M</span>
                  )}
                </div>

                {/* header */}
                <div className="grid grid-cols-[3rem_1fr_5rem_5rem_8rem_4rem] gap-x-3 border-b border-line px-4 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
                  <div>No.</div>
                  <div>{noun}</div>
                  <div className="text-right">Pick %</div>
                  <div className="text-right">Last Rd</div>
                  <div>Price ($M)</div>
                  <div className="text-right">Δ</div>
                </div>

                {classRows.map((r) => {
                  const dirty = isDirty(r)
                  const invalid = isInvalid(r)
                  const n = numOf(r)
                  const delta = n != null && r.lastRound != null ? n - r.lastRound : null
                  return (
                    <div
                      key={rowKey(r)}
                      className={`grid grid-cols-[3rem_1fr_5rem_5rem_8rem_4rem] items-center gap-x-3 border-b border-line px-4 py-2 last:border-b-0 ${
                        invalid ? 'bg-danger/[0.06]' : dirty ? 'bg-warn/[0.05]' : ''
                      }`}
                    >
                      <div
                        className="border-l-[3px] pl-2 font-mono text-[13px] font-semibold text-ink"
                        style={{ borderColor: classMeta(r.className, classColor(r.classId)).hex }}
                      >
                        {r.number ?? '—'}
                      </div>
                      <div className="truncate font-sans text-[13px] text-ink-2">{r.label}</div>
                      <div className="text-right font-mono text-[12px] text-muted">
                        <Demo>{mockPickPct(r.entityId)}%</Demo>
                      </div>
                      <div className="text-right font-mono text-[12px] text-muted-2">
                        {r.lastRound != null ? `$${r.lastRound.toFixed(1)}` : '—'}
                      </div>
                      <div>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted-2">
                            $
                          </span>
                          <input
                            value={valueOf(r)}
                            onChange={(e) => setEdits((p) => ({ ...p, [rowKey(r)]: e.target.value }))}
                            inputMode="decimal"
                            placeholder="—"
                            aria-label={`Price for ${r.label}`}
                            className={`h-8 w-28 rounded-[4px] border bg-surface-3 pl-5 pr-2 font-mono text-[13px] text-ink focus:outline-none ${
                              invalid
                                ? 'border-danger'
                                : dirty
                                  ? 'border-warn'
                                  : 'border-line-2 focus:border-brand'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="text-right font-mono text-[12px]">
                        {delta == null || delta === 0 ? (
                          <span className="text-muted-2">—</span>
                        ) : (
                          <span className={delta > 0 ? 'text-success' : 'text-danger'}>
                            {delta > 0 ? '+' : ''}
                            {delta.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">{label}</span>
      <span className="font-mono text-[15px] text-ink">{value}</span>
    </div>
  )
}
