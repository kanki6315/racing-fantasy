import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from '../../admin/AdminContext'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { PrimaryButton, ClassSwatch, EmptyState } from '../../admin/ui'
import { useCarEntries, useAdminClasses, useSavePrices, useEntryDrivers, useDrivers } from '../../api/adminQueries'
import { usePrices, useRosterRules } from '../../api/queries'
import { classMeta } from '../../lib/classMeta'
import {
  curvePrices,
  defaultAnchors,
  defaultStep,
  expectedRosterCost,
  fitAnchorsToBudget,
  roundToStep,
  seedRanking,
  type ClassAnchors,
  type ClassBudgetInput,
} from '../../lib/priceSuggest'

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

/** Suggestion engine state (ADR-0012) — all client-side, reset on round/mode change. */
type SuggestState = {
  on: boolean
  gamma: number
  alpha: number // target: average roster ≈ alpha × cap
  budgetMode: 'alpha' | 'total'
  totalInput: string // absolute target when budgetMode = 'total'
  step: number
  anchors: Record<number, ClassAnchors> // classId -> top/floor
  ranks: Record<number, string[]> // classId -> rowKeys, best → worst
  pins: Record<string, number> // rowKey -> exact price
}

const SUGGEST_OFF: SuggestState = {
  on: false,
  gamma: 1.6,
  alpha: 0.92,
  budgetMode: 'alpha',
  totalInput: '',
  step: 0.5,
  anchors: {},
  ranks: {},
  pins: {},
}

export function Prices() {
  const { roundId, round, seasonId, championshipId, rounds } = useAdmin()
  const { data: cars = [] } = useCarEntries(seasonId)
  const { data: classes = [] } = useAdminClasses(championshipId)
  const { data: prices = [] } = usePrices(roundId ?? 0)
  const { data: entryDrivers = [] } = useEntryDrivers()
  const { data: allDrivers = [] } = useDrivers()
  const { data: rosterRules } = useRosterRules(roundId ?? 0)

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
  const [suggest, setSuggest] = useState<SuggestState>(SUGGEST_OFF)
  const save = useSavePrices(roundId ?? 0)

  // Suggestion state is round + mode local by design (ADR-0012: ephemeral v1).
  useEffect(() => {
    setSuggest(SUGGEST_OFF)
    setEdits({})
  }, [roundId, mode])

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
  const rowByKey = useMemo(() => new Map(rows.map((r) => [rowKey(r), r])), [rows])

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

  const cap = round?.salaryCap ?? 0
  const byClass = classes.filter((cl) => rows.some((r) => r.classId === cl.id))

  // Roster slots per class (for the expected-roster-cost drift): the required pick count.
  const slotsByClass = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of rosterRules?.classes ?? []) m.set(c.classId, c.min > 0 ? c.min : c.max)
    return m
  }, [rosterRules])
  const totalSlots = byClass.reduce((a, cl) => a + (slotsByClass.get(cl.id) ?? 0), 0)

  const budgetTarget =
    suggest.budgetMode === 'alpha'
      ? suggest.alpha * cap
      : Number.isFinite(Number(suggest.totalInput))
        ? Number(suggest.totalInput)
        : 0

  /** Ranking for a class, self-repairing: drop vanished keys, append new rows at the bottom. */
  const ranksFor = (classId: number): string[] => {
    const classKeys = rows.filter((r) => r.classId === classId).map(rowKey)
    const stored = (suggest.ranks[classId] ?? []).filter((k) => rowByKey.has(k) && rowByKey.get(k)!.classId === classId)
    const missing = classKeys.filter((k) => !stored.includes(k))
    return [...stored, ...missing]
  }

  const curveInputs = (): ClassBudgetInput[] =>
    byClass.map((cl) => ({
      orderedKeys: ranksFor(cl.id),
      anchors: suggest.anchors[cl.id] ?? defaultAnchors(budgetTarget, Math.max(totalSlots, 1)),
      pins: new Map(Object.entries(suggest.pins).filter(([k]) => rowByKey.get(k)?.classId === cl.id)),
      slots: slotsByClass.get(cl.id) ?? 0,
    }))

  // rowKey -> suggested price (pins pass through exactly; curve values snap to the step).
  const suggestions = useMemo(() => {
    if (!suggest.on) return null
    const m = new Map<string, number>()
    for (const input of curveInputs())
      for (const [k, v] of curvePrices(input, suggest.gamma))
        m.set(k, suggest.pins[k] != null ? v : Math.max(roundToStep(v, suggest.step), 0))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggest, rows, slotsByClass, budgetTarget])

  const expectedCost = useMemo(
    () => (suggest.on ? expectedRosterCost(curveInputs(), suggest.gamma) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions],
  )

  const onEnableSuggest = () => {
    // Seed each class's ranking (prev price → current price → entry order) and anchors
    // (prev-round spread when it exists, else shaped around the budget's per-slot mean).
    const ranks: Record<number, string[]> = {}
    const anchors: Record<number, ClassAnchors> = {}
    const step = defaultStep(cap)
    const target = SUGGEST_OFF.alpha * cap
    for (const cl of byClass) {
      const keys = rows.filter((r) => r.classId === cl.id).map(rowKey)
      ranks[cl.id] = seedRanking(
        keys,
        (k) => rowByKey.get(k)?.lastRound ?? null,
        (k) => rowByKey.get(k)?.original ?? null,
      )
      const prev = keys.map((k) => rowByKey.get(k)?.lastRound).filter((n): n is number => n != null)
      anchors[cl.id] =
        prev.length >= 2
          ? { top: Math.max(...prev), floor: Math.min(...prev) }
          : defaultAnchors(target, Math.max(totalSlots, 1))
    }
    setSuggest({ ...SUGGEST_OFF, on: true, step, ranks, anchors })
  }

  const onFitBudget = () => {
    const inputs = curveInputs()
    const fitted = fitAnchorsToBudget(inputs, suggest.gamma, budgetTarget)
    const anchors: Record<number, ClassAnchors> = {}
    byClass.forEach((cl, i) => {
      const a = fitted.get(inputs[i])
      if (a) anchors[cl.id] = { top: roundToStep(a.top, suggest.step), floor: roundToStep(a.floor, suggest.step) }
    })
    setSuggest((s) => ({ ...s, anchors }))
  }

  const applyOne = (k: string) => {
    const v = suggestions?.get(k)
    if (v != null) setEdits((p) => ({ ...p, [k]: String(v) }))
  }
  const applyAll = () => {
    if (!suggestions) return
    const next: Record<string, string> = {}
    for (const [k, v] of suggestions) next[k] = String(v)
    setEdits((p) => ({ ...p, ...next }))
  }

  const moveRank = (classId: number, k: string, dir: -1 | 1) => {
    setSuggest((s) => {
      const order = ranksFor(classId)
      const i = order.indexOf(k)
      const j = i + dir
      if (i < 0 || j < 0 || j >= order.length) return s
      const next = [...order]
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...s, ranks: { ...s.ranks, [classId]: next } }
    })
  }

  const togglePin = (k: string) => {
    setSuggest((s) => {
      const pins = { ...s.pins }
      if (pins[k] != null) delete pins[k]
      else pins[k] = suggestions?.get(k) ?? 0
      return { ...s, pins }
    })
  }

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

  const noun = mode === 'Car' ? 'Team' : 'Driver'
  const drift = expectedCost - budgetTarget
  const driftOk = budgetTarget > 0 && Math.abs(drift) <= budgetTarget * 0.03
  const gridCols = suggest.on
    ? 'grid-cols-[2.2rem_2.6rem_minmax(7rem,1fr)_4rem_8rem_6.5rem_2.5rem]'
    : 'grid-cols-[3rem_1fr_5rem_8rem_4rem]'

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
      <div className="mb-3 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[6px] border border-line bg-surface px-5 py-3">
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
        <Stat label="Salary Cap" value={`$${cap.toFixed(1)}M`} />
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
        <button
          onClick={() => (suggest.on ? setSuggest(SUGGEST_OFF) : onEnableSuggest())}
          className={`ml-auto rounded-[4px] border px-3 py-[6px] font-mono text-[10px] uppercase tracking-[0.08em] ${
            suggest.on ? 'border-brand/60 bg-brand/15 text-brand' : 'border-line-2 text-muted hover:text-ink-2'
          }`}
        >
          {suggest.on ? 'Suggesting · On' : 'Suggest Prices'}
        </button>
      </div>

      {/* Suggestion panel (ADR-0012): knobs + budget drift. Suggestions only pre-fill inputs. */}
      {suggest.on && (
        <div className="mb-5 rounded-[6px] border border-brand/30 bg-surface px-5 py-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
                Steepness γ · {suggest.gamma.toFixed(2)}
              </span>
              <input
                type="range"
                min={1}
                max={2.5}
                step={0.05}
                value={suggest.gamma}
                onChange={(e) => setSuggest((s) => ({ ...s, gamma: Number(e.target.value) }))}
                className="w-40 accent-[var(--color-brand,#e10600)]"
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">Budget target</span>
              <div className="flex items-center gap-2">
                <div className="flex overflow-hidden rounded-[4px] border border-line-2">
                  {(['alpha', 'total'] as const).map((bm) => (
                    <button
                      key={bm}
                      onClick={() => setSuggest((s) => ({ ...s, budgetMode: bm }))}
                      className={`px-2 py-1 font-mono text-[9px] uppercase ${
                        suggest.budgetMode === bm ? 'bg-brand/15 text-brand' : 'text-muted hover:text-ink-2'
                      }`}
                    >
                      {bm === 'alpha' ? '% of cap' : 'roster $'}
                    </button>
                  ))}
                </div>
                {suggest.budgetMode === 'alpha' ? (
                  <>
                    <input
                      type="range"
                      min={0.7}
                      max={1.1}
                      step={0.01}
                      value={suggest.alpha}
                      onChange={(e) => setSuggest((s) => ({ ...s, alpha: Number(e.target.value) }))}
                      className="w-32 accent-[var(--color-brand,#e10600)]"
                    />
                    <span className="font-mono text-[11px] text-ink">{Math.round(suggest.alpha * 100)}%</span>
                  </>
                ) : (
                  <input
                    value={suggest.totalInput}
                    onChange={(e) => setSuggest((s) => ({ ...s, totalInput: e.target.value }))}
                    inputMode="decimal"
                    placeholder={`${(cap * 0.92).toFixed(1)}`}
                    aria-label="Target average roster cost"
                    className="h-7 w-20 rounded-[4px] border border-line-2 bg-surface-3 px-2 font-mono text-[12px] text-ink focus:border-brand focus:outline-none"
                  />
                )}
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">Rounding</span>
              <select
                value={suggest.step}
                onChange={(e) => setSuggest((s) => ({ ...s, step: Number(e.target.value) }))}
                className="h-7 rounded-[4px] border border-line-2 bg-surface-3 px-2 font-mono text-[11px] text-ink focus:border-brand focus:outline-none"
              >
                {[0.05, 0.1, 0.25, 0.5, 1].map((st) => (
                  <option key={st} value={st}>
                    ${st}M
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={onFitBudget}
                disabled={budgetTarget <= 0 || totalSlots === 0}
                className="rounded-[4px] border border-line-2 px-3 py-[6px] font-mono text-[10px] uppercase tracking-[0.08em] text-ink-2 hover:border-brand hover:text-brand disabled:opacity-40"
              >
                Fit to budget
              </button>
              <button
                onClick={applyAll}
                className="rounded-[4px] border border-line-2 px-3 py-[6px] font-mono text-[10px] uppercase tracking-[0.08em] text-ink-2 hover:border-brand hover:text-brand"
              >
                Apply all →
              </button>
            </div>

            <div className="ml-auto flex flex-col items-end gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">Avg roster</span>
              {totalSlots === 0 ? (
                <span className="font-mono text-[11px] text-warn">no roster rules — set composition first</span>
              ) : (
                <span className={`font-mono text-[13px] ${driftOk ? 'text-success' : 'text-warn'}`}>
                  ${expectedCost.toFixed(1)}M
                  <span className="text-muted-2"> / target ${budgetTarget.toFixed(1)}M</span>
                </span>
              )}
            </div>
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-2">
            Rank with ▲▼ · click ◇ to pin an exact price (curve bends through pins) · suggestions fill the
            inputs, Save All persists
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState>
          {mode === 'Car'
            ? 'No car entries for this season — import entries first'
            : 'No drivers for this season — import an entry list first'}
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {byClass.map((cl) => {
            const order = suggest.on ? ranksFor(cl.id) : null
            const classRows = order
              ? order.map((k) => rowByKey.get(k)!).filter(Boolean)
              : rows.filter((r) => r.classId === cl.id)
            const priced = classRows.map(numOf).filter((n): n is number => n != null)
            const avg = priced.length ? priced.reduce((a, b) => a + b, 0) / priced.length : null
            const anchors = suggest.anchors[cl.id]
            const ladder = suggest.on
              ? classRows.map((r) => suggestions?.get(rowKey(r)) ?? 0)
              : []
            return (
              <div key={cl.id} className="overflow-hidden rounded-[6px] border border-line bg-surface">
                <div className="flex items-center gap-2 border-b border-line px-4 py-2">
                  <ClassSwatch hex={classMeta(cl.name, cl.color).hex} />
                  <span className="font-display text-[13px] font-semibold uppercase text-ink">{cl.name}</span>
                  <span className="font-mono text-[10px] text-muted-2">
                    {classRows.length} {mode === 'Car' ? 'cars' : 'drivers'}
                  </span>
                  {suggest.on && anchors && (
                    <span className="ml-4 flex items-center gap-2 font-mono text-[10px] text-muted">
                      top
                      <AnchorInput
                        value={anchors.top}
                        onChange={(v) =>
                          setSuggest((s) => ({ ...s, anchors: { ...s.anchors, [cl.id]: { ...anchors, top: v } } }))
                        }
                      />
                      floor
                      <AnchorInput
                        value={anchors.floor}
                        onChange={(v) =>
                          setSuggest((s) => ({ ...s, anchors: { ...s.anchors, [cl.id]: { ...anchors, floor: v } } }))
                        }
                      />
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-3">
                    {suggest.on && ladder.length > 1 && <Ladder values={ladder} />}
                    {avg != null && <span className="font-mono text-[10px] text-muted">avg ${avg.toFixed(1)}M</span>}
                  </span>
                </div>

                {/* header */}
                <div
                  className={`grid ${gridCols} gap-x-3 border-b border-line px-4 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2`}
                >
                  {suggest.on && <div>Rank</div>}
                  <div>No.</div>
                  <div>{noun}</div>
                  <div className="text-right">Last Rd</div>
                  {suggest.on && <div>Suggested ($M)</div>}
                  <div>Price ($M)</div>
                  <div className="text-right">Δ</div>
                </div>

                {classRows.map((r, idx) => {
                  const k = rowKey(r)
                  const dirty = isDirty(r)
                  const invalid = isInvalid(r)
                  const n = numOf(r)
                  const delta = n != null && r.lastRound != null ? n - r.lastRound : null
                  const sugg = suggestions?.get(k)
                  const pinned = suggest.pins[k] != null
                  return (
                    <div
                      key={k}
                      className={`grid ${gridCols} items-center gap-x-3 border-b border-line px-4 py-2 last:border-b-0 ${
                        invalid ? 'bg-danger/[0.06]' : dirty ? 'bg-warn/[0.05]' : ''
                      }`}
                    >
                      {suggest.on && (
                        <div className="flex items-center gap-[2px]">
                          <button
                            onClick={() => moveRank(cl.id, k, -1)}
                            disabled={idx === 0}
                            aria-label={`Move ${r.label} up`}
                            className="rounded-[3px] px-[3px] text-[10px] text-muted hover:text-ink disabled:opacity-25"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveRank(cl.id, k, 1)}
                            disabled={idx === classRows.length - 1}
                            aria-label={`Move ${r.label} down`}
                            className="rounded-[3px] px-[3px] text-[10px] text-muted hover:text-ink disabled:opacity-25"
                          >
                            ▼
                          </button>
                        </div>
                      )}
                      <div
                        className="border-l-[3px] pl-2 font-mono text-[13px] font-semibold text-ink"
                        style={{ borderColor: classMeta(r.className, classColor(r.classId)).hex }}
                      >
                        {r.number ?? '—'}
                      </div>
                      <div className="truncate font-sans text-[13px] text-ink-2">{r.label}</div>
                      <div className="text-right font-mono text-[12px] text-muted-2">
                        {r.lastRound != null ? `$${r.lastRound.toFixed(1)}` : '—'}
                      </div>
                      {suggest.on && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => togglePin(k)}
                            aria-label={pinned ? `Unpin ${r.label}` : `Pin ${r.label} at suggested price`}
                            title={pinned ? 'Unpin — return to curve' : 'Pin exact price'}
                            className={`font-mono text-[13px] ${pinned ? 'text-brand' : 'text-muted-2 hover:text-ink-2'}`}
                          >
                            {pinned ? '◆' : '◇'}
                          </button>
                          {pinned ? (
                            <input
                              value={String(suggest.pins[k])}
                              onChange={(e) => {
                                const v = Number(e.target.value)
                                if (Number.isFinite(v))
                                  setSuggest((s) => ({ ...s, pins: { ...s.pins, [k]: v } }))
                              }}
                              inputMode="decimal"
                              aria-label={`Pinned price for ${r.label}`}
                              className="h-7 w-16 rounded-[4px] border border-brand/50 bg-surface-3 px-2 font-mono text-[12px] text-brand focus:border-brand focus:outline-none"
                            />
                          ) : (
                            <span className="w-16 font-mono text-[12px] text-ink-2">
                              {sugg != null ? `$${sugg.toFixed(2)}` : '—'}
                            </span>
                          )}
                          <button
                            onClick={() => applyOne(k)}
                            aria-label={`Apply suggested price to ${r.label}`}
                            title="Apply to price input"
                            className="rounded-[3px] px-1 font-mono text-[12px] text-muted hover:text-brand"
                          >
                            →
                          </button>
                        </div>
                      )}
                      <div>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted-2">
                            $
                          </span>
                          <input
                            value={valueOf(r)}
                            onChange={(e) => setEdits((p) => ({ ...p, [k]: e.target.value }))}
                            inputMode="decimal"
                            placeholder="—"
                            aria-label={`Price for ${r.label}`}
                            className={`h-8 ${suggest.on ? 'w-24' : 'w-28'} rounded-[4px] border bg-surface-3 pl-5 pr-2 font-mono text-[13px] text-ink focus:outline-none ${
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

function AnchorInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Local text state so partial input ("1.", "") doesn't fight the parsed number.
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      value={text ?? String(value)}
      onChange={(e) => {
        setText(e.target.value)
        const v = Number(e.target.value)
        if (Number.isFinite(v) && e.target.value.trim() !== '') onChange(v)
      }}
      onBlur={() => setText(null)}
      inputMode="decimal"
      className="h-6 w-14 rounded-[3px] border border-line-2 bg-surface-3 px-1 text-center font-mono text-[10px] text-ink focus:border-brand focus:outline-none"
    />
  )
}

/** Rank-vs-price sparkline for one class — makes curve shape and gaps visible pre-apply. */
function Ladder({ values }: { values: number[] }) {
  const w = 120
  const h = 22
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => ({
    x: values.length > 1 ? (i / (values.length - 1)) * (w - 6) + 3 : w / 2,
    y: h - 3 - ((v - min) / span) * (h - 6),
  }))
  return (
    <svg width={w} height={h} aria-label="Suggested price ladder" className="text-muted-2">
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="currentColor" />
      ))}
    </svg>
  )
}
