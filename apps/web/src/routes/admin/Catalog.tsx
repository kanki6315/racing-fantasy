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
  type Championship,
  type ClassDto,
  type RoundDto,
} from '../../api/adminQueries'
import { useRosterRules } from '../../api/queries'
import { classMeta } from '../../lib/classMeta'

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
  const create = useCreateChampionship()
  const update = useUpdateChampionship()
  const { data: seasons = [] } = useAdminSeasons(championship?.id)
  const createSeason = useCreateSeason()
  const [year, setYear] = useState('')

  const save = async () => {
    if (championship) await update.mutateAsync({ id: championship.id, body: { name, slug } })
    else {
      const created = await create.mutateAsync({ name, slug })
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
            const m = classMeta(c.name)
            return (
              <ListRow key={c.id} selected={c.id === sel} onClick={() => setSel(c.id)}>
                <ClassSwatch hex={m.hex} />
                <span className="font-display text-[14px] font-semibold uppercase tracking-[0.02em] text-ink">
                  {c.name}
                </span>
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
  const create = useCreateClass()
  const update = useUpdateClass()
  const del = useDeleteClass()
  const m = classMeta(name)

  const save = async () => {
    if (cls) await update.mutateAsync({ id: cls.id, body: { name } })
    else {
      const created = await create.mutateAsync({ championshipId, name })
      onSaved(created.id)
    }
  }

  return (
    <div className="rounded-[6px] border border-line bg-surface p-4">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
        {cls ? 'Edit Class' : 'New Class'}
      </h2>
      <div className="grid gap-4">
        <Field label="Name" hint="Color is derived from the class name (GTP, LMP2, GTD PRO, GTD).">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="GTP" />
        </Field>
        <div className="flex items-center gap-2 rounded-[4px] border border-line bg-surface-3 px-3 py-2">
          <ClassSwatch hex={m.hex} />
          <span className="font-display text-[13px] font-semibold uppercase text-ink-2">{m.label}</span>
          <span className="ml-auto font-mono text-[11px] text-muted">{m.hex}</span>
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
          <PrimaryButton onClick={save} disabled={!name || create.isPending || update.isPending}>
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
  const [eventId, setEventId] = useState(round?.eventId != null ? String(round.eventId) : '')
  const create = useCreateRound()
  const update = useUpdateRound()
  const { data: events = [] } = useAdminEvents()

  const save = async () => {
    const body = {
      name,
      circuit: circuit || null,
      sequence: Number(sequence),
      salaryCap: Number(salaryCap),
      qualiStart: localInputToIso(qualiStart),
      startsAt: round?.startsAt ?? null,
      endsAt: round?.endsAt ?? null,
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
        <Field label="Qualifying Start (lock)" hint="Picks lock for all players when qualifying begins.">
          <TextInput type="datetime-local" value={qualiStart} onChange={(e) => setQualiStart(e.target.value)} />
        </Field>
        <Field
          label="Shared Event"
          hint="Optional. Link this round to a shared race weekend so it groups with other championships running it."
        >
          <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">— None (standalone) —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {ev.circuit ? ` · ${ev.circuit}` : ''}
              </option>
            ))}
          </Select>
        </Field>
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
                    <ClassSwatch hex={classMeta(className(s.classId)).hex} />
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

// ===================== Roster Rules (read-only this pass) =====================
function RosterRulesTab() {
  const { roundId } = useAdmin()
  const { data: rules, isLoading } = useRosterRules(roundId ?? 0)

  if (!roundId) return <EmptyState>Select a round in the topbar</EmptyState>
  if (isLoading || !rules) return <EmptyState>Loading roster rules…</EmptyState>

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-6 rounded-[6px] border border-line bg-surface px-5 py-4">
        <div>
          <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-muted-2">Salary Cap</div>
          <div className="font-mono text-[18px] text-ink">${rules.salaryCap.toFixed(1)}M</div>
        </div>
        <div className="font-sans text-[12px] text-muted">
          Composition resolved for this round (season rules ∩ classes running). Cap is edited per-round under{' '}
          <span className="text-ink-2">Rounds</span>; full min/max editing lands in a later pass.
        </div>
      </div>

      <div className="rounded-[6px] border border-line bg-surface">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] font-mono text-[9px] tracking-[0.12em] uppercase text-muted-2">
          <div className="border-b border-line px-4 py-2">Class</div>
          <div className="border-b border-line px-4 py-2">Slot</div>
          <div className="border-b border-line px-4 py-2">Min</div>
          <div className="border-b border-line px-4 py-2">Max</div>
        </div>
        {rules.classes.map((c) => (
          <div key={c.classId} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <ClassSwatch hex={classMeta(c.name).hex} />
              <span className="font-display text-[13px] font-semibold uppercase text-ink">{c.name ?? '—'}</span>
            </div>
            <div className="border-b border-line px-4 py-3 font-mono text-[12px] text-muted">{c.slot}</div>
            <div className="border-b border-line px-4 py-3 font-mono text-[12px] text-ink-2">{c.min}</div>
            <div className="border-b border-line px-4 py-3 font-mono text-[12px] text-ink-2">{c.max}</div>
          </div>
        ))}
      </div>

      {rules.modifiers.length > 0 && (
        <div className="rounded-[6px] border border-line bg-surface p-4">
          <div className="mb-3 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">Bonus Modifiers</div>
          <div className="flex flex-wrap gap-2">
            {rules.modifiers.map((m) => (
              <span
                key={m.kind}
                className="rounded-[3px] border border-line-2 bg-surface-3 px-3 py-1 font-mono text-[11px] text-ink-2"
              >
                {m.kind} · max {m.maxCount} · {m.appliesTo}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
