import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  usePrices,
  useRosterRules,
  useRound,
  useRoster,
  useSaveRoster,
  type PriceItem,
  type RosterError,
} from '../api/queries'
import { classMeta } from '../lib/classMeta'
import { useCountdown } from '../lib/useCountdown'
import { EntityThumb } from '../components/EntityThumb'
import { DriverLineup } from '../components/DriverLineup'

const key = (p: { entityType: string; entityId: number }) => `${p.entityType}:${p.entityId}`

type Target = { entityType: 'Car' | 'Driver'; entityId: number }

// Friendly labels for bonus modifiers (ADR-0006). Unknown kinds fall back to their raw key.
const MODIFIER_META: Record<string, { label: string; hint: string }> = {
  DOUBLE_POINTS_TEAM: { label: 'Double Points Team', hint: 'One of your teams scores double — added as bonus points.' },
  CAPTAIN: { label: 'Captain', hint: 'Your captain driver scores double.' },
}
const modMeta = (kind: string) => MODIFIER_META[kind] ?? { label: kind, hint: '' }

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

  // Draft roster: one entry per classId (Main) — a team or a driver depending on the series — plus
  // selected bonuses; each modifier kind maps to the pick it targets. IMPACT removed (ADR-0006).
  const [main, setMain] = useState<Map<number, PriceItem>>(new Map())
  const [modifiers, setModifiers] = useState<Map<string, Target>>(new Map())
  // Small-screen view toggle: the pit lane and the selection board stack into one column and switch
  // via a segmented control (desktop shows both side by side, so this is ignored at lg+).
  const [mobileTab, setMobileTab] = useState<'lineup' | 'board'>('lineup')

  // Seed the draft from the saved roster once both it and the price board (for display names) load.
  useEffect(() => {
    if (!roster.data || !prices.data) return
    const pm = new Map(prices.data.map((p) => [key(p), p]))
    const m = new Map<number, PriceItem>()
    for (const pk of roster.data.main) {
      const it = pm.get(key(pk))
      if (it) m.set(it.classId, it)
    }
    setMain(m)
    const mm = new Map<string, Target>()
    for (const mod of roster.data.modifiers ?? []) {
      if (mod.target) mm.set(mod.kind, { entityType: mod.target.entityType as Target['entityType'], entityId: mod.target.entityId })
    }
    setModifiers(mm)
  }, [roster.data, prices.data])

  const cd = useCountdown(round.data?.qualiStart)
  const locked = cd.locked || roster.data?.locked === true

  const cap = rules.data?.salaryCap ?? round.data?.salaryCap ?? 0
  const selected = useMemo(() => [...main.values()], [main])
  const spent = selected.reduce((s, p) => s + p.price, 0)
  const remaining = cap - spent

  // Bonus rules the pick UI can currently fulfil (car-targeted). Drives the Bonuses selectors + pill.
  const modifierRules = (rules.data?.modifiers ?? []).filter((m) => SUPPORTED_APPLIES_TO.has(m.appliesTo))

  const composition = (rules.data?.classes ?? []).map((c) => {
    const have = main.has(c.classId) ? 1 : 0
    return { ...c, have, ok: have >= c.min && have <= c.max }
  })
  const compositionOk = composition.every((c) => c.ok)
  const canSave = !locked && compositionOk && remaining >= 0 && !save.isPending

  // Drop any bonus whose target pick is leaving the roster, so a modifier never points at a gone team.
  const dropTargeting = (m: Map<string, Target>, pick: { entityType: string; entityId: number }) => {
    let changed = false
    const n = new Map(m)
    for (const [k, t] of m) if (t.entityType === pick.entityType && t.entityId === pick.entityId) { n.delete(k); changed = true }
    return changed ? n : m
  }
  // A class slot holds one entry — a team (car) or a driver. Adding either replaces that slot.
  const addPick = (item: PriceItem) => {
    if (locked) return
    const replaced = main.get(item.classId)
    setMain((prev) => new Map(prev).set(item.classId, item))
    if (replaced && !(replaced.entityType === item.entityType && replaced.entityId === item.entityId))
      setModifiers((prev) => dropTargeting(prev, replaced))
  }
  const removeClass = (classId: number) => {
    if (locked) return
    const removed = main.get(classId)
    setMain((prev) => {
      const n = new Map(prev)
      n.delete(classId)
      return n
    })
    if (removed) setModifiers((prev) => dropTargeting(prev, removed))
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
    const mainKeys = new Set(selected.map((p) => key(p)))
    save.mutate({
      main: [...main.values()].map((c) => ({ entityType: c.entityType, entityId: c.entityId })),
      modifiers: [...modifiers.entries()]
        .filter(([, t]) => mainKeys.has(`${t.entityType}:${t.entityId}`))
        .map(([kind, t]) => ({ kind, target: { entityType: t.entityType, entityId: t.entityId }, params: null })),
    })
  }

  if (!user) return null
  if (round.isLoading || rules.isLoading || prices.isLoading) {
    return <div className="py-32 text-center font-mono text-[12px] uppercase tracking-[0.12em] text-muted-2">Loading board…</div>
  }
  if (round.isError || rules.isError || prices.isError) {
    return (
      <div className="mx-4 my-12 rounded-[4px] border border-danger/30 bg-danger/[0.06] px-5 py-12 text-center font-sans text-[13px] text-danger sm:mx-[26px]">
        Couldn't load the selection board. Please refresh to try again.
      </div>
    )
  }
  if (round.data && registration == null) {
    return (
      <div className="flex flex-col items-center gap-3 py-32 text-center">
        <div className="font-display text-[22px] font-bold uppercase text-ink">Register first</div>
        <div className="font-sans text-[13px] text-muted">You need a team for this season before setting a lineup.</div>
        <Link to="/" className="mt-2 rounded-[3px] bg-brand px-5 py-2 font-display text-[14px] font-bold uppercase text-ink">
          Claim your team
        </Link>
      </div>
    )
  }

  const err = save.error as RosterError | null
  const classNameById = new Map((rules.data?.classes ?? []).map((c) => [c.classId, c.name]))

  return (
    <div>
      {/* header band: budget + requirements + actions */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-surface px-4 py-3 sm:px-[26px]">
        <div>
          <h1 className="font-display text-[11px] uppercase tracking-[0.12em] text-muted-2">{round.data?.name}</h1>
          <div className="font-mono text-[20px] font-bold text-ink">${cap.toFixed(1)}M</div>
        </div>
        <div className="w-full sm:w-[280px]">
          <div className="mb-1 flex justify-between font-sans text-[12px]">
            <span className="text-muted">Spent ${spent.toFixed(1)}M</span>
            <span className={remaining < 0 ? 'text-danger' : 'text-success'}>${remaining.toFixed(1)}M left</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, Math.max(0, (spent / (cap || 1)) * 100))}%`,
                background: remaining < 0 ? '#ff5d5d' : 'linear-gradient(90deg,#e10600,#ff5d5d)',
              }}
            />
          </div>
        </div>

        {/* requirement pills */}
        <div className="flex gap-[7px]">
          {composition.map((c) => {
            const m = classMeta(c.name)
            return (
              <div
                key={c.classId}
                className="flex flex-col items-center gap-[2px] rounded-[3px] border px-[10px] py-[6px]"
                style={{ borderColor: c.ok ? m.hex : '#4a4f57', background: c.ok ? `${m.hex}1a` : 'transparent' }}
              >
                <span className="font-mono text-[10px] font-semibold" style={{ color: m.hex }}>{m.label}</span>
                <span className={`font-mono text-[11px] ${c.ok ? 'text-ink' : 'text-warn'}`}>{c.have}/{c.max}</span>
              </div>
            )
          })}
          {modifierRules.length > 0 && (
            <div
              className="flex flex-col items-center gap-[2px] rounded-[3px] border px-[10px] py-[6px]"
              style={{
                borderColor: modifiers.size > 0 ? '#ffc23d' : '#3a3f47',
                background: modifiers.size > 0 ? 'rgba(255,194,61,.1)' : 'transparent',
              }}
            >
              <span className="font-mono text-[10px] font-semibold text-ink-2">BONUS</span>
              <span className="font-mono text-[11px] text-ink">{modifiers.size}/{modifierRules.length}</span>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-[7px] rounded-[3px] border px-3 py-[6px] ${
              locked ? 'border-danger/45 bg-danger/10' : 'border-line-2'
            }`}
          >
            <span className={`h-[6px] w-[6px] rounded-full ${locked ? 'bg-danger' : 'bg-brand [animation:blink_1.4s_infinite]'}`} />
            <span className={`font-mono text-[12px] font-semibold ${locked ? 'text-danger' : 'text-brand-3'}`}>
              {locked ? 'LOCKED' : `LOCKS ${cd.text}`}
            </span>
          </div>
          <button
            type="button"
            disabled={!canSave}
            onClick={onSave}
            className={`h-10 rounded-[3px] px-6 font-display text-[15px] font-bold italic uppercase tracking-[0.05em] text-ink ${
              canSave ? 'bg-brand cursor-pointer' : 'bg-[#3a1614] opacity-60 cursor-not-allowed'
            }`}
          >
            {save.isPending ? 'Saving…' : 'Save Lineup'}
          </button>
        </div>
      </div>

      {/* save feedback */}
      {save.isSuccess && (
        <div className="bg-success/10 px-4 py-2 font-sans text-[13px] text-success sm:px-[26px]">Lineup saved.</div>
      )}
      {err && (
        <div className="bg-danger/10 px-4 py-2 font-sans text-[13px] text-danger sm:px-[26px]">
          {err.error === 'locked' && (err.message ?? 'Picks are locked.')}
          {err.error === 'cap_exceeded' && `Over the cap by $${(spent - cap).toFixed(1)}M.`}
          {err.error === 'composition' && 'Lineup composition is invalid — check the class requirements.'}
          {err.error === 'modifier' && 'A selected bonus is invalid — re-pick it.'}
          {err.error === 'unavailable' && 'Some picks are no longer available; please re-select.'}
        </div>
      )}

      {/* mobile view toggle — desktop shows both panels side by side, so this is hidden at lg+ */}
      <div className="flex gap-1 border-b border-line bg-surface px-4 py-2 lg:hidden">
        {(['lineup', 'board'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`flex-1 rounded-[3px] py-[7px] font-display text-[12px] font-bold uppercase tracking-[0.06em] ${
              mobileTab === tab ? 'bg-brand text-ink' : 'bg-surface-2 text-muted'
            }`}
          >
            {tab === 'lineup' ? 'Your Lineup' : 'Add Picks'}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className={`${mobileTab === 'lineup' ? 'block' : 'hidden'} flex-1 lg:block`}>
          <PitLane
            classes={rules.data?.classes ?? []}
            main={main}
            roundId={rid}
            locked={locked}
            onRemoveClass={removeClass}
            modifierRules={modifierRules}
            modifiers={modifiers}
            mainPicks={selected}
            onToggleModifier={toggleModifier}
          />
        </div>
        <div
          className={`${
            mobileTab === 'board' ? 'block' : 'hidden'
          } w-full border-line lg:block lg:w-[560px] lg:flex-none lg:border-l`}
        >
          <SelectionPanel
            prices={prices.data ?? []}
            classList={rules.data?.classes ?? []}
            classNameById={classNameById}
            mainSelected={main}
            roundId={rid}
            locked={locked}
            onAddPick={addPick}
          />
        </div>
      </div>
    </div>
  )
}

// ---- Pit lane (your picks) ----
function PitLane({
  classes,
  main,
  roundId,
  locked,
  onRemoveClass,
  modifierRules,
  modifiers,
  mainPicks,
  onToggleModifier,
}: {
  classes: { classId: number; name: string | null; min: number; max: number }[]
  main: Map<number, PriceItem>
  roundId: number
  locked: boolean
  onRemoveClass: (classId: number) => void
  modifierRules: { kind: string; maxCount: number; appliesTo: string }[]
  modifiers: Map<string, Target>
  mainPicks: PriceItem[]
  onToggleModifier: (kind: string, item: PriceItem) => void
}) {
  return (
    <div className="flex-1 bg-gradient-to-b from-[#15171a] to-[#0d0f11] p-6">
      <div className="mb-3 font-display text-[12px] uppercase tracking-[0.14em] text-muted">Your Pit Lane</div>
      <div className="flex flex-col gap-3">
        {classes.map((c) => {
          const m = classMeta(c.name)
          const pick = main.get(c.classId)
          return (
            <div key={c.classId} className="flex items-stretch gap-3">
              <div className="flex w-[58px] flex-col items-center justify-center gap-1">
                <span className="font-mono text-[11px] font-bold" style={{ color: m.hex }}>{m.label}</span>
                <span className="w-[2px] flex-1" style={{ background: m.hex }} />
              </div>
              {pick ? (
                <div
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-[4px] border border-line bg-surface-2 px-3 py-3 sm:gap-4 sm:px-4"
                  style={{ borderLeft: `3px solid ${m.hex}` }}
                >
                  <EntityThumb
                    entityType={pick.entityType}
                    entityId={pick.entityId}
                    roundId={roundId}
                    shape={pick.entityType === 'Car' ? 'wide' : 'square'}
                    tintHex={m.hex}
                    className="w-20 sm:w-24"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[16px] font-bold uppercase text-ink sm:text-[18px]">{pick.displayName}</div>
                    <DriverLineup drivers={pick.drivers} className="mt-[7px]" />
                    <div className="mt-[7px] font-mono text-[13px] text-ink-2">${pick.price.toFixed(1)}M</div>
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => onRemoveClass(c.classId)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-line-3 bg-surface cursor-pointer"
                      aria-label="Remove"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={m.hex} strokeWidth="2.4"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 items-center gap-3 rounded-[4px] border border-dashed border-line-3 px-4 py-5 text-muted">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={m.hex} strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
                  <span className="font-display text-[15px] font-bold uppercase" style={{ color: m.hex }}>Add a {m.label} pick</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* bonuses — a selector per available bonus rule (ADR-0006). Pick which team gets the bonus. */}
      {modifierRules.length > 0 && (
        <div className="mt-5 rounded-[4px] border border-line bg-surface-3 p-4">
          <div className="mb-3 flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#ffc23d"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
            <span className="font-display text-[15px] font-bold uppercase tracking-[0.04em] text-ink">Bonuses</span>
          </div>
          <div className="flex flex-col gap-3">
            {modifierRules.map((rule) => {
              const meta = modMeta(rule.kind)
              const eligible = rule.appliesTo === 'Driver' ? mainPicks.filter((p) => p.entityType === 'Driver') : mainPicks
              const target = modifiers.get(rule.kind)
              return (
                <div key={rule.kind} className="rounded-[4px] border border-line-2 bg-surface-2 p-3">
                  <div className="font-display text-[14px] font-bold uppercase tracking-[0.03em] text-ink">{meta.label}</div>
                  {meta.hint && <div className="mt-[2px] font-sans text-[12px] text-muted">{meta.hint}</div>}
                  {eligible.length === 0 ? (
                    <div className="mt-2 font-sans text-[12px] text-muted-2">
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
                            className={`rounded-full border px-3 py-[5px] font-display text-[12px] font-semibold uppercase tracking-[0.03em] ${
                              locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                            }`}
                            style={
                              sel
                                ? { borderColor: '#ffc23d', background: 'rgba(255,194,61,.12)', color: '#fff' }
                                : { borderColor: '#3a3f47', color: '#8a8f98' }
                            }
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
}: {
  prices: PriceItem[]
  classList: { classId: number; name: string | null }[]
  classNameById: Map<number, string | null>
  mainSelected: Map<number, PriceItem>
  roundId: number
  locked: boolean
  onAddPick: (item: PriceItem) => void
}) {
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<number | null>(null)

  const q = search.trim().toLowerCase()
  // Team series if the board has cars; otherwise a driver-based series (MX-5 Cup) picks drivers.
  const cars = prices.filter((p) => p.entityType === 'Car')
  const teamBased = cars.length > 0
  const pool = teamBased ? cars : prices.filter((p) => p.entityType === 'Driver')
  const heading = teamBased ? 'Teams' : 'Drivers'
  // Show a per-row class badge only when the series actually runs multiple classes (ADR — a one-make
  // cup wouldn't need it). Drives both the badge and whether the flat list interleaves classes.
  const multiClass = classList.length > 1

  // Cars order by race number (numeric-aware so "#04" sorts before "#7"); driver series keep price order.
  const list = pool
    .filter((p) => !q || (p.displayName ?? '').toLowerCase().includes(q))
    .sort((a, b) =>
      teamBased ? (a.number ?? '').localeCompare(b.number ?? '', undefined, { numeric: true }) : b.price - a.price,
    )

  return (
    <div className="flex w-full flex-col bg-surface-3">
      <div className="flex h-[46px] items-center border-b border-line px-4">
        <span className="flex items-center gap-[6px] font-display text-[15px] font-bold uppercase tracking-[0.04em] text-ink">
          {heading}
          <span className="font-mono text-[11px] text-muted-2">·{pool.length}</span>
        </span>
      </div>

      <div className="flex flex-col gap-[10px] px-4 pt-[14px] pb-[10px]">
        <div className="flex h-[38px] items-center gap-[9px] rounded-[3px] border border-line-2 bg-surface-2 px-[13px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5c626b" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={teamBased ? 'Search teams…' : 'Search drivers…'}
            aria-label={teamBased ? 'Search teams' : 'Search drivers'}
            className="w-full bg-transparent font-sans text-[13px] text-ink outline-none placeholder:text-muted-2"
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
                className={`rounded-full border px-3 py-[5px] font-display text-[12px] font-semibold uppercase tracking-[0.04em] cursor-pointer ${
                  active ? 'border-brand text-ink' : 'border-line-2 text-muted'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {list
          .filter((p) => classFilter === null || p.classId === classFilter)
          .map((p) => {
            const cur = mainSelected.get(p.classId)
            const selected = !!cur && cur.entityType === p.entityType && cur.entityId === p.entityId
            const cm = classMeta(classNameById.get(p.classId))
            return (
              <div key={key(p)} className="flex items-center gap-3 border-b border-surface-2 px-4 py-[10px]">
                <EntityThumb
                  entityType={p.entityType}
                  entityId={p.entityId}
                  roundId={roundId}
                  shape={p.entityType === 'Car' ? 'wide' : 'square'}
                  tintHex={cm.hex}
                  className="w-14"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {multiClass && (
                      <span
                        className="shrink-0 rounded-[3px] border px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-[0.04em]"
                        style={{ color: cm.hex, borderColor: `${cm.hex}66`, background: `${cm.hex}1a` }}
                      >
                        {cm.label}
                      </span>
                    )}
                    <span className="truncate font-display text-[15px] font-bold uppercase text-ink">{p.displayName}</span>
                  </div>
                  <DriverLineup drivers={p.drivers} variant="compact" className="mt-[3px]" />
                </div>
                <div className="font-mono text-[14px] font-bold text-ink">${p.price.toFixed(1)}M</div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onAddPick(p)}
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      selected ? 'bg-brand' : 'border border-line-3 bg-surface'
                    } ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    aria-label={selected ? 'Selected' : 'Add'}
                  >
                    {selected ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6"><path d="M5 12h14" /></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8ccd2" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
