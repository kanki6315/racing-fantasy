import { useState } from 'react'
import { useAdmin } from '../../admin/AdminContext'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import {
  Field,
  TextInput,
  Select,
  PrimaryButton,
  GhostButton,
  Tabs,
  ListRow,
  ClassSwatch,
  EmptyState,
} from '../../admin/ui'
import {
  useAdminChampionships,
  useAdminSeasons,
  useAdminClasses,
  useAdminRounds,
  useAdminSessions,
  useCreateChampionship,
  useUpdateChampionship,
  useCreateSeason,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useCreateRound,
  useUpdateRound,
  useAdminEvents,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  useAdminRosterRules,
  useCreateRosterRule,
  useUpdateRosterRule,
  useDeleteRosterRule,
  useAdminModifierRules,
  useCreateModifierRule,
  useUpdateModifierRule,
  useDeleteModifierRule,
  type Championship,
  type ClassDto,
  type RoundDto,
  type RosterRuleDto,
  type RosterModifierRuleDto,
} from '../../api/adminQueries'
import { classMeta } from '../../lib/classMeta'
import { MODIFIER_FORMATS, modMeta } from '../../lib/modifierMeta'

const TABS = [
  { id: 'championships', label: 'Championships' },
  { id: 'classes', label: 'Classes' },
  { id: 'rounds', label: 'Rounds' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'roster-rules', label: 'Roster Rules' },
]

// ---- datetime-local <-> ISO helpers ----
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localInputToIso(v: string): string {
  return v ? new Date(v).toISOString() : ''
}

export function Catalog() {
  const [tab, setTab] = useState('championships')
  return (
    <>
      <AdminPageHeader
        title="Catalog"
        subtitle="Championships, seasons, classes, rounds, sessions and the per-season roster rules that govern picks."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'championships' && <ChampionshipsTab />}
      {tab === 'classes' && <ClassesTab />}
      {tab === 'rounds' && <RoundsTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'roster-rules' && <RosterRulesTab />}
    </>
  )
}

// ===================== Championships & Seasons =====================
function ChampionshipsTab() {
  const { data: champs = [] } = useAdminChampionships()
  const [sel, setSel] = useState<number | null>(null)
  const selected = champs.find((c) => c.id === sel) ?? null

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[6px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
            {champs.length} series
          </span>
          <GhostButton onClick={() => setSel(null)}>+ New</GhostButton>
        </div>
        {champs.length === 0 ? (
          <div className="p-4">
            <EmptyState>No championships yet</EmptyState>
          </div>
        ) : (
          champs.map((c) => (
            <ListRow key={c.id} selected={c.id === sel} onClick={() => setSel(c.id)}>
              <div className="flex-1">
                <div className="font-display text-[14px] font-semibold uppercase tracking-[0.02em] text-ink">
                  {c.name}
                </div>
                <div className="font-mono text-[10px] text-muted">/{c.slug}</div>
              </div>
              <span className="shrink-0 rounded-[3px] border border-line-2 bg-surface-3 px-2 py-[2px] font-mono text-[10px] text-muted-2">
                #{c.order}
              </span>
            </ListRow>
          ))
        )}
      </div>
      <ChampionshipForm key={selected?.id ?? 'new'} championship={selected} onSaved={setSel} />
    </div>
  )
}

function ChampionshipForm({
  championship,
  onSaved,
}: {
  championship: Championship | null
  onSaved: (id: number) => void
}) {
  const [name, setName] = useState(championship?.name ?? '')
  const [slug, setSlug] = useState(championship?.slug ?? '')
  const [order, setOrder] = useState(String(championship?.order ?? 0))
  const create = useCreateChampionship()
  const update = useUpdateChampionship()
  const { data: seasons = [] } = useAdminSeasons(championship?.id)
  const createSeason = useCreateSeason()
  const [year, setYear] = useState('')

  const save = async () => {
    const body = { name, slug, order: Number(order) || 0 }
    if (championship) await update.mutateAsync({ id: championship.id, body })
    else {
      const created = await create.mutateAsync(body)
      onSaved(created.id)
    }
  }

  return (
    <div className="rounded-[6px] border border-line bg-surface p-4">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
        {championship ? 'Edit Championship' : 'New Championship'}
      </h2>
      <div className="grid gap-4">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="IMSA WeatherTech" />
        </Field>
        <Field label="Slug">
          <TextInput value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="imsa-weathertech" />
        </Field>
        <Field label="Order">
          <TextInput
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="0"
            inputMode="numeric"
            className="w-28"
          />
          <p className="mt-1 font-sans text-[11px] text-muted">Lower sorts first — ranks this series ahead of higher numbers everywhere.</p>
        </Field>
        <div className="flex justify-end">
          <PrimaryButton onClick={save} disabled={!name || !slug || create.isPending || update.isPending}>
            {championship ? 'Save' : 'Create'}
          </PrimaryButton>
        </div>
      </div>

      {championship && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2 font-mono text-[9px] tracking-[0.12em] uppercase text-muted-2">Seasons</div>
          <div className="mb-3 flex flex-wrap gap-2">
            {seasons.length === 0 && <span className="font-sans text-[12px] text-muted">No seasons yet</span>}
            {[...seasons]
              .sort((a, b) => b.year - a.year)
              .map((s) => (
                <span
                  key={s.id}
                  className="rounded-[3px] border border-line-2 bg-surface-3 px-2 py-1 font-mono text-[11px] text-ink-2"
                >
                  {s.year}
                </span>
              ))}
          </div>
          <div className="flex gap-2">
            <TextInput
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2027"
              inputMode="numeric"
              className="w-28"
            />
            <GhostButton
              onClick={async () => {
                if (!year) return
                await createSeason.mutateAsync({ championshipId: championship.id, year: Number(year) })
                setYear('')
              }}
              disabled={!year || createSeason.isPending}
            >
              + Add Season
            </GhostButton>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== Classes =====================
function ClassesTab() {
  const { championshipId, championship } = useAdmin()
  const { data: classes = [] } = useAdminClasses(championshipId)
  const [sel, setSel] = useState<number | null>(null)
  const selected = classes.find((c) => c.id === sel) ?? null

  if (!championshipId) return <EmptyState>Select a championship in the topbar</EmptyState>

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[6px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
            {championship?.name} · {classes.length} classes
          </span>
          <GhostButton onClick={() => setSel(null)}>+ New</GhostButton>
        </div>
        {classes.length === 0 ? (
          <div className="p-4">
            <EmptyState>No classes yet</EmptyState>
          </div>
        ) : (
          classes.map((c) => {
            const m = classMeta(c.name, c.color)
            return (
              <ListRow key={c.id} selected={c.id === sel} onClick={() => setSel(c.id)}>
                <ClassSwatch hex={m.hex} />
                <span className="font-display text-[14px] font-semibold uppercase tracking-[0.02em] text-ink">
                  {c.name}
                </span>
                <span className="ml-auto font-mono text-[10px] text-muted-2">#{c.sortOrder}</span>
              </ListRow>
            )
          })
        )}
      </div>
      <ClassForm key={selected?.id ?? 'new'} championshipId={championshipId} cls={selected} onSaved={setSel} />
    </div>
  )
}

function ClassForm({
  championshipId,
  cls,
  onSaved,
}: {
  championshipId: number
  cls: ClassDto | null
  onSaved: (id: number | null) => void
}) {
  const [name, setName] = useState(cls?.name ?? '')
  const [color, setColor] = useState(cls?.color ?? '')
  const [order, setOrder] = useState(String(cls?.sortOrder ?? 0))
  const create = useCreateClass()
  const update = useUpdateClass()
  const del = useDeleteClass()

  const fallback = classMeta(name)
  const hexError = color !== '' && !/^#[0-9a-fA-F]{6}$/.test(color)
  const pickerHex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback.hex // native picker needs a valid value
  const swatchHex = color || fallback.hex // empty color → name-derived palette

  const save = async () => {
    const body = { name, color: color || null, sortOrder: Number(order) || 0 }
    if (cls) await update.mutateAsync({ id: cls.id, body })
    else {
      const created = await create.mutateAsync({ championshipId, ...body })
      onSaved(created.id)
    }
  }

  return (
    <div className="rounded-[6px] border border-line bg-surface p-4">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
        {cls ? 'Edit Class' : 'New Class'}
      </h2>
      <div className="grid gap-4">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="GTP" />
        </Field>
        <Field label="Color" hint="Leave blank to fall back to the name-based palette (GTP, LMP2, GTD PRO, GTD).">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={pickerHex}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Pick class color"
              className="h-9 w-12 shrink-0 cursor-pointer rounded-[4px] border border-line-2 bg-surface-3 p-1"
            />
            <TextInput
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder={fallback.hex}
              aria-label="Class color hex code"
              className="flex-1 font-mono uppercase"
            />
            {color && <GhostButton onClick={() => setColor('')}>Clear</GhostButton>}
          </div>
          {hexError && (
            <span className="mt-1 block font-sans text-[11px] text-danger">Must be a #RRGGBB hex code.</span>
          )}
        </Field>
        <Field label="Order">
          <TextInput
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="0"
            inputMode="numeric"
            className="w-28"
          />
          <p className="mt-1 font-sans text-[11px] text-muted">Lower sorts first — sets the racing order (GTP, LMP2, GTD PRO, GTD) on the pick board, picks view and admin.</p>
        </Field>
        <div className="flex items-center gap-2 rounded-[4px] border border-line bg-surface-3 px-3 py-2">
          <ClassSwatch hex={swatchHex} />
          <span className="font-display text-[13px] font-semibold uppercase text-ink-2">{fallback.label}</span>
          <span className="ml-auto font-mono text-[11px] text-muted">
            {color ? 'custom' : 'derived'} · {swatchHex}
          </span>
        </div>
        <div className="flex justify-between">
          {cls ? (
            <GhostButton
              onClick={async () => {
                await del.mutateAsync(cls.id)
                onSaved(null)
              }}
              disabled={del.isPending}
              className="!text-danger hover:!border-danger/50"
            >
              Delete
            </GhostButton>
          ) : (
            <span />
          )}
          <PrimaryButton onClick={save} disabled={!name || hexError || create.isPending || update.isPending}>
            {cls ? 'Save' : 'Create'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

// ===================== Rounds =====================
function RoundsTab() {
  const { seasonId, season } = useAdmin()
  const { data: rounds = [] } = useAdminRounds(seasonId)
  const [sel, setSel] = useState<number | null>(null)
  const selected = rounds.find((r) => r.id === sel) ?? null

  if (!seasonId) return <EmptyState>Select a season in the topbar</EmptyState>

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[6px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
            {season?.year} · {rounds.length} rounds
          </span>
          <GhostButton onClick={() => setSel(null)}>+ New</GhostButton>
        </div>
        {rounds.length === 0 ? (
          <div className="p-4">
            <EmptyState>No rounds yet</EmptyState>
          </div>
        ) : (
          [...rounds]
            .sort((a, b) => a.sequence - b.sequence)
            .map((r) => (
              <ListRow key={r.id} selected={r.id === sel} onClick={() => setSel(r.id)}>
                <span className="w-8 font-mono text-[12px] text-muted">{String(r.sequence).padStart(2, '0')}</span>
                <div className="flex-1">
                  <div className="font-display text-[14px] font-semibold uppercase text-ink">{r.name}</div>
                  <div className="font-mono text-[10px] text-muted">{r.circuit ?? '—'}</div>
                </div>
                <span className="font-mono text-[11px] text-ink-2">${r.salaryCap.toFixed(1)}M</span>
              </ListRow>
            ))
        )}
      </div>
      <RoundForm key={selected?.id ?? 'new'} seasonId={seasonId} round={selected} onSaved={setSel} />
    </div>
  )
}

function RoundForm({
  seasonId,
  round,
  onSaved,
}: {
  seasonId: number
  round: RoundDto | null
  onSaved: (id: number) => void
}) {
  const [name, setName] = useState(round?.name ?? '')
  const [circuit, setCircuit] = useState(round?.circuit ?? '')
  const [sequence, setSequence] = useState(String(round?.sequence ?? ''))
  const [salaryCap, setSalaryCap] = useState(String(round?.salaryCap ?? ''))
  const [qualiStart, setQualiStart] = useState(isoToLocalInput(round?.qualiStart))
  const [startsAt, setStartsAt] = useState(isoToLocalInput(round?.startsAt))
  const [endsAt, setEndsAt] = useState(isoToLocalInput(round?.endsAt))
  const [eventId, setEventId] = useState(round?.eventId != null ? String(round.eventId) : '')
  const create = useCreateRound()
  const update = useUpdateRound()
  const { data: events = [] } = useAdminEvents()

  // Picking a shared event copies its weekend details (name/circuit/dates) into the form so the
  // admin doesn't re-type them; the per-championship fields (quali lock, round #, cap) are left
  // alone (ADR-0007). All copied fields stay editable. Clearing the event leaves them as-is.
  const onEventChange = (value: string) => {
    setEventId(value)
    const ev = value ? events.find((e) => String(e.id) === value) : undefined
    if (ev) {
      setName(ev.name)
      setCircuit(ev.circuit ?? '')
      setStartsAt(isoToLocalInput(ev.startsAt))
      setEndsAt(isoToLocalInput(ev.endsAt))
    }
  }

  const save = async () => {
    const body = {
      name,
      circuit: circuit || null,
      sequence: Number(sequence),
      salaryCap: Number(salaryCap),
      qualiStart: localInputToIso(qualiStart),
      startsAt: startsAt ? localInputToIso(startsAt) : null,
      endsAt: endsAt ? localInputToIso(endsAt) : null,
      eventId: eventId ? Number(eventId) : null,
    }
    if (round) await update.mutateAsync({ id: round.id, body })
    else {
      const created = await create.mutateAsync({ seasonId, ...body })
      onSaved(created.id)
    }
  }

  const valid = name && sequence && salaryCap && qualiStart

  return (
    <div className="rounded-[6px] border border-line bg-surface p-4">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
        {round ? 'Edit Round' : 'New Round'}
      </h2>
      <div className="grid gap-4">
        <Field
          label="Shared Event"
          hint="Optional. Pick a master event to auto-fill name, circuit, and weekend dates; you can still edit them. Links this round to other championships running the same weekend."
        >
          <Select value={eventId} onChange={(e) => onEventChange(e.target.value)}>
            <option value="">— None (standalone) —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {ev.circuit ? ` · ${ev.circuit}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Watkins Glen" />
        </Field>
        <Field label="Circuit">
          <TextInput value={circuit} onChange={(e) => setCircuit(e.target.value)} placeholder="Watkins Glen International" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Round #">
            <TextInput value={sequence} onChange={(e) => setSequence(e.target.value)} inputMode="numeric" placeholder="7" />
          </Field>
          <Field label="Salary Cap ($M)">
            <TextInput value={salaryCap} onChange={(e) => setSalaryCap(e.target.value)} inputMode="decimal" placeholder="120" />
          </Field>
        </div>
        <Field label="Qualifying Start (lock)" hint="Per championship — not copied from the event. Picks lock for all players when qualifying begins.">
          <TextInput type="datetime-local" value={qualiStart} onChange={(e) => setQualiStart(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weekend Start">
            <TextInput type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Weekend End">
            <TextInput type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <PrimaryButton onClick={save} disabled={!valid || create.isPending || update.isPending}>
            {round ? 'Save' : 'Create'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

// ===================== Sessions =====================
const SESSION_STATUSES = ['Scheduled', 'Live', 'Complete', 'Published'] as const

function SessionsTab() {
  const { roundId, round, championshipId } = useAdmin()
  const { data: sessions = [] } = useAdminSessions(roundId)
  const { data: classes = [] } = useAdminClasses(championshipId)
  const createSession = useCreateSession()
  const updateSession = useUpdateSession()
  const deleteSession = useDeleteSession()
  const [newClass, setNewClass] = useState<string>('')
  const [newType, setNewType] = useState<'Qualifying' | 'Race'>('Qualifying')

  const className = (id: number) => classes.find((c) => c.id === id)?.name ?? `#${id}`
  const classColor = (id: number) => classes.find((c) => c.id === id)?.color

  if (!roundId) return <EmptyState>Select a round in the topbar</EmptyState>

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3 rounded-[6px] border border-line bg-surface p-4">
        <Field label="Class">
          <Select value={newClass} onChange={(e) => setNewClass(e.target.value)} className="w-44">
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type">
          <Select value={newType} onChange={(e) => setNewType(e.target.value as 'Qualifying' | 'Race')} className="w-40">
            <option value="Qualifying">Qualifying</option>
            <option value="Race">Race</option>
          </Select>
        </Field>
        <PrimaryButton
          onClick={async () => {
            if (!newClass) return
            await createSession.mutateAsync({
              roundId,
              classId: Number(newClass),
              type: newType,
              scheduledStart: null,
              status: 'Scheduled',
            })
            setNewClass('')
          }}
          disabled={!newClass || createSession.isPending}
        >
          + Add Session
        </PrimaryButton>
      </div>

      <div className="rounded-[6px] border border-line bg-surface">
        <div className="border-b border-line px-4 py-3 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
          {round?.name} · {sessions.length} sessions
        </div>
        {sessions.length === 0 ? (
          <div className="p-4">
            <EmptyState>No sessions for this round</EmptyState>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-center gap-x-4">
            <div className="contents font-mono text-[9px] tracking-[0.12em] uppercase text-muted-2">
              <div className="border-b border-line px-4 py-2">Class</div>
              <div className="border-b border-line px-4 py-2">Type</div>
              <div className="border-b border-line px-4 py-2">Status</div>
              <div className="border-b border-line px-4 py-2" />
            </div>
            {sessions.map((s) => (
              <div key={s.id} className="contents">
                <div className="border-b border-line px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ClassSwatch hex={classMeta(className(s.classId), classColor(s.classId)).hex} />
                    <span className="font-display text-[13px] font-semibold uppercase text-ink">
                      {className(s.classId)}
                    </span>
                  </div>
                </div>
                <div className="border-b border-line px-4 py-3 font-mono text-[12px] text-ink-2">{s.type}</div>
                <div className="border-b border-line px-4 py-3">
                  <Select
                    value={s.status}
                    onChange={(e) =>
                      updateSession.mutate({
                        id: s.id,
                        body: {
                          type: s.type,
                          scheduledStart: s.scheduledStart,
                          actualStart: s.actualStart,
                          status: e.target.value as (typeof SESSION_STATUSES)[number],
                        },
                      })
                    }
                    className="!h-8 w-36"
                  >
                    {SESSION_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="border-b border-line px-4 py-3">
                  <button
                    type="button"
                    onClick={() => deleteSession.mutate(s.id)}
                    className="font-mono text-[11px] uppercase text-muted-2 hover:text-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ===================== Roster Rules (editable) =====================
function RosterRulesTab() {
  const { championshipId, seasonId, roundId, round } = useAdmin()
  if (!seasonId) return <EmptyState>Select a season in the topbar</EmptyState>
  return (
    <div className="grid gap-5">
      <CompositionEditor
        championshipId={championshipId}
        seasonId={seasonId}
        roundId={roundId}
        roundName={round?.name}
      />
      <BonusFormatsEditor seasonId={seasonId} />
    </div>
  )
}

// ---- Composition: season defaults + per-round overrides ----
function CompositionEditor({
  championshipId,
  seasonId,
  roundId,
  roundName,
}: {
  championshipId?: number
  seasonId: number
  roundId?: number
  roundName?: string
}) {
  const [scope, setScope] = useState<'round' | 'season'>(roundId ? 'round' : 'season')
  const effScope = roundId ? scope : 'season'
  const { data: classes = [] } = useAdminClasses(championshipId)
  const { data: rules = [] } = useAdminRosterRules(seasonId)
  const { data: sessions = [] } = useAdminSessions(effScope === 'round' ? roundId : undefined)

  const mainRule = (classId: number, rid: number | null) =>
    rules.find((r) => r.classId === classId && r.slotType === 'Main' && (r.roundId ?? null) === rid)

  return (
    <div className="rounded-[6px] border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">Composition</div>
          <div className="mt-1 font-sans text-[12px] text-muted">
            Picks required per class.{' '}
            {effScope === 'round'
              ? `Overrides apply to ${roundName ?? 'this round'} only; unset classes use the season default.`
              : 'The season default applies to every round unless a round overrides it.'}
          </div>
        </div>
        {roundId && (
          <div className="flex overflow-hidden rounded-[4px] border border-line-2">
            {(['round', 'season'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`px-3 py-[6px] font-mono text-[11px] uppercase tracking-[0.04em] cursor-pointer ${
                  scope === s ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink-2'
                }`}
              >
                {s === 'round' ? roundName ?? 'This round' : 'Season default'}
              </button>
            ))}
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="p-4">
          <EmptyState>No classes for this championship yet</EmptyState>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[2fr_5rem_5rem_1fr] border-b border-line px-4 py-2 font-mono text-[9px] tracking-[0.12em] uppercase text-muted-2">
            <div>Class</div>
            <div className="text-center">Min</div>
            <div className="text-center">Max</div>
            <div />
          </div>
          {classes.map((cls) => {
            const def = mainRule(cls.id, null)
            const override = effScope === 'round' ? mainRule(cls.id, roundId!) : undefined
            const editing = effScope === 'season' ? def : override
            const running = effScope === 'round' && sessions.some((s) => s.classId === cls.id)
            return (
              <CompositionRow
                key={`${cls.id}-${effScope}-${editing?.id ?? 'new'}`}
                cls={cls}
                scope={effScope}
                seasonId={seasonId}
                roundId={roundId}
                defaultRule={def}
                overrideRule={override}
                running={running}
                showRunning={effScope === 'round'}
              />
            )
          })}
        </>
      )}
    </div>
  )
}

function CompositionRow({
  cls,
  scope,
  seasonId,
  roundId,
  defaultRule,
  overrideRule,
  running,
  showRunning,
}: {
  cls: ClassDto
  scope: 'round' | 'season'
  seasonId: number
  roundId?: number
  defaultRule?: RosterRuleDto
  overrideRule?: RosterRuleDto
  running: boolean
  showRunning: boolean
}) {
  const create = useCreateRosterRule()
  const update = useUpdateRosterRule()
  const del = useDeleteRosterRule()

  const editing = scope === 'season' ? defaultRule : overrideRule
  const seed = editing ?? (scope === 'round' ? defaultRule : undefined) // round prefills from the default
  const [min, setMin] = useState(seed ? String(seed.minPicks) : '')
  const [max, setMax] = useState(seed ? String(seed.maxPicks) : '')

  const minN = Number(min)
  const maxN = Number(max)
  const valid =
    min !== '' && max !== '' && Number.isInteger(minN) && Number.isInteger(maxN) && minN >= 0 && maxN >= minN
  const dirty = !editing || String(editing.minPicks) !== min || String(editing.maxPicks) !== max
  const pending = create.isPending || update.isPending || del.isPending

  const save = async () => {
    if (!valid || !dirty) return
    if (editing) await update.mutateAsync({ id: editing.id, body: { minPicks: minN, maxPicks: maxN } })
    else
      await create.mutateAsync({
        seasonId,
        roundId: scope === 'round' ? roundId! : null,
        classId: cls.id,
        slotType: 'Main',
        minPicks: minN,
        maxPicks: maxN,
      })
  }

  return (
    <div className="grid grid-cols-[2fr_5rem_5rem_1fr] items-center border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <ClassSwatch hex={classMeta(cls.name, cls.color).hex} />
        <span className="font-display text-[13px] font-semibold uppercase text-ink">{cls.name}</span>
        {showRunning && !running && (
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-2">not running</span>
        )}
      </div>
      <div className="px-1">
        <TextInput value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric"
          aria-label={`${cls.name} min`} className="text-center" />
      </div>
      <div className="px-1">
        <TextInput value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric"
          aria-label={`${cls.name} max`} className="text-center" />
      </div>
      <div className="flex items-center justify-end gap-2">
        {scope === 'round' &&
          (overrideRule ? (
            <span className="rounded-[3px] border border-brand/40 bg-brand/[0.08] px-2 py-[2px] font-mono text-[9px] uppercase tracking-[0.08em] text-brand">
              override
            </span>
          ) : (
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-2">
              default {defaultRule ? `${defaultRule.minPicks}/${defaultRule.maxPicks}` : '—'}
            </span>
          ))}
        {scope === 'round' && overrideRule && (
          <GhostButton onClick={() => del.mutateAsync(overrideRule.id)} disabled={pending} className="!px-2">
            Reset
          </GhostButton>
        )}
        <PrimaryButton onClick={save} disabled={!valid || !dirty || pending} className="!px-3">
          Save
        </PrimaryButton>
      </div>
    </div>
  )
}

// ---- Bonus formats (roster modifiers, season-scoped) ----
function BonusFormatsEditor({ seasonId }: { seasonId: number }) {
  const { data: rules = [] } = useAdminModifierRules(seasonId)
  const create = useCreateModifierRule()
  const del = useDeleteModifierRule()
  const update = useUpdateModifierRule()

  const present = new Set(rules.map((r) => r.kind))
  const available = MODIFIER_FORMATS.filter((f) => !present.has(f.kind))
  const [kind, setKind] = useState('')
  const [maxCount, setMaxCount] = useState('1')

  const add = async () => {
    const fmt = MODIFIER_FORMATS.find((f) => f.kind === kind)
    const n = Number(maxCount)
    if (!fmt || !Number.isInteger(n) || n < 1) return
    await create.mutateAsync({ seasonId, kind: fmt.kind, maxCount: n, appliesTo: fmt.appliesTo })
    setKind('')
    setMaxCount('1')
  }

  return (
    <div className="rounded-[6px] border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">Bonus Formats</div>
        <div className="mt-1 font-sans text-[12px] text-muted">
          Free per-round bonuses players may add to a roster (ADR-0006). Configured per season.
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="p-4">
          <EmptyState>No bonus formats yet</EmptyState>
        </div>
      ) : (
        rules.map((r) => (
          <BonusRow key={r.id} rule={r} onSave={(n) => update.mutateAsync({ id: r.id, body: { maxCount: n, appliesTo: r.appliesTo } })}
            onDelete={() => del.mutateAsync(r.id)} busy={update.isPending || del.isPending} />
        ))
      )}

      {available.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-t border-line px-4 py-4">
          <Field label="Add bonus">
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-56">
              <option value="">Select a format…</option>
              {available.map((f) => (
                <option key={f.kind} value={f.kind}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Max / roster">
            <TextInput value={maxCount} onChange={(e) => setMaxCount(e.target.value)} inputMode="numeric" className="w-20 text-center" />
          </Field>
          <PrimaryButton onClick={add} disabled={!kind || create.isPending}>
            Add
          </PrimaryButton>
        </div>
      )}
    </div>
  )
}

function BonusRow({
  rule,
  onSave,
  onDelete,
  busy,
}: {
  rule: RosterModifierRuleDto
  onSave: (maxCount: number) => Promise<unknown>
  onDelete: () => Promise<unknown>
  busy: boolean
}) {
  const [maxCount, setMaxCount] = useState(String(rule.maxCount))
  const n = Number(maxCount)
  const valid = Number.isInteger(n) && n >= 1
  const dirty = String(rule.maxCount) !== maxCount
  const meta = modMeta(rule.kind)
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-[180px] flex-1">
        <div className="font-display text-[13px] font-semibold uppercase text-ink">{meta.label}</div>
        <div className="font-mono text-[10px] text-muted-2">{rule.appliesTo}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-2">Max</span>
        <TextInput value={maxCount} onChange={(e) => setMaxCount(e.target.value)} inputMode="numeric" className="w-16 text-center" />
        <PrimaryButton onClick={() => valid && dirty && onSave(n)} disabled={!valid || !dirty || busy} className="!px-3">
          Save
        </PrimaryButton>
        <GhostButton onClick={onDelete} disabled={busy} className="!text-danger hover:!border-danger/50 !px-2">
          Remove
        </GhostButton>
      </div>
    </div>
  )
}
