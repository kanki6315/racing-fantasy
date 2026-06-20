import { useMemo, useState } from 'react'
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
  useCarEntries,
  useAdminClasses,
  useDrivers,
  useEntryDrivers,
  useCreateCarEntry,
  useUpdateCarEntry,
  useDeleteCarEntry,
  useCreateDriver,
  useUpdateDriver,
  useDeleteDriver,
  useCreateEntryDriver,
  useDeleteEntryDriver,
  type CarEntryDto,
  type DriverDto,
} from '../../api/adminQueries'
import { classMeta } from '../../lib/classMeta'
import { ImageUpload } from '../../admin/ImageUpload'
import { headshotUrl, liveryUrl } from '../../lib/images'

const TABS = [
  { id: 'cars', label: 'Car Entries' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'lineups', label: 'Lineups' },
]

export function Entries() {
  const { seasonId } = useAdmin()
  const [tab, setTab] = useState('cars')

  return (
    <>
      <AdminPageHeader title="Entries" subtitle="Cars, drivers and lineups for the selected season." />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {!seasonId ? (
        <EmptyState>Select a season in the topbar</EmptyState>
      ) : (
        <>
          {tab === 'cars' && <CarEntriesTab seasonId={seasonId} />}
          {tab === 'drivers' && <DriversTab />}
          {tab === 'lineups' && <LineupsTab seasonId={seasonId} />}
        </>
      )}
    </>
  )
}

// ===================== Car Entries =====================
function CarEntriesTab({ seasonId }: { seasonId: number }) {
  const { championshipId } = useAdmin()
  const { data: classes = [] } = useAdminClasses(championshipId)
  const [filterClass, setFilterClass] = useState<number | 'all'>('all')
  const { data: cars = [] } = useCarEntries(seasonId, filterClass === 'all' ? undefined : filterClass)
  const { data: links = [] } = useEntryDrivers()
  const [sel, setSel] = useState<number | null>(null)
  const [bulk, setBulk] = useState(false)
  const selected = cars.find((c) => c.id === sel) ?? null

  const driverCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const l of links) m.set(l.carEntryId, (m.get(l.carEntryId) ?? 0) + 1)
    return m
  }, [links])

  return (
    <div className="grid gap-5">
      {bulk && (
        <CarEntryBulkGrid seasonId={seasonId} classes={classes} onClose={() => setBulk(false)} />
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
      <div className="rounded-[6px] border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <button
            type="button"
            onClick={() => setFilterClass('all')}
            className={`h-7 rounded-[3px] px-2 font-mono text-[11px] uppercase ${
              filterClass === 'all' ? 'bg-ink text-bg' : 'border border-line-2 text-muted hover:text-ink-2'
            }`}
          >
            All {cars.length}
          </button>
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilterClass(c.id)}
              className={`flex h-7 items-center gap-[6px] rounded-[3px] px-2 font-mono text-[11px] uppercase ${
                filterClass === c.id ? 'bg-surface-2 text-ink' : 'border border-line-2 text-muted hover:text-ink-2'
              }`}
            >
              <ClassSwatch hex={classMeta(c.name, c.color).hex} />
              {c.name}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <GhostButton
              onClick={() => {
                setBulk((b) => !b)
                setSel(null)
              }}
            >
              Bulk add
            </GhostButton>
            <GhostButton onClick={() => setSel(null)}>+ New</GhostButton>
          </div>
        </div>
        {cars.length === 0 ? (
          <div className="p-4">
            <EmptyState>No car entries</EmptyState>
          </div>
        ) : (
          cars.map((c) => {
            const cl = classes.find((cl) => cl.id === c.classId)
            const m = classMeta(cl?.name, cl?.color)
            return (
              <ListRow key={c.id} selected={c.id === sel} onClick={() => setSel(c.id)}>
                <span
                  className="w-10 shrink-0 border-l-[3px] pl-2 font-mono text-[13px] font-semibold text-ink"
                  style={{ borderColor: m.hex }}
                >
                  {c.number}
                </span>
                <span className="flex-1 font-sans text-[13px] text-ink-2">{c.teamName}</span>
                <span className="font-mono text-[10px] uppercase text-muted">{m.label}</span>
                <span className="w-16 text-right font-mono text-[11px] text-muted-2">
                  {driverCount.get(c.id) ?? 0} drv
                </span>
              </ListRow>
            )
          })
        )}
      </div>
      <CarEntryForm
        key={selected?.id ?? 'new'}
        seasonId={seasonId}
        classes={classes}
        car={selected}
        onSaved={setSel}
      />
      </div>
    </div>
  )
}

function CarEntryForm({
  seasonId,
  classes,
  car,
  onSaved,
}: {
  seasonId: number
  classes: { id: number; name: string; color?: string | null }[]
  car: CarEntryDto | null
  onSaved: (id: number | null) => void
}) {
  const [number, setNumber] = useState(car?.number ?? '')
  const [teamName, setTeamName] = useState(car?.teamName ?? '')
  const [classId, setClassId] = useState<number | ''>(car?.classId ?? '')
  const create = useCreateCarEntry()
  const update = useUpdateCarEntry()
  const del = useDeleteCarEntry()
  const { roundId, round } = useAdmin()

  const save = async () => {
    if (car) await update.mutateAsync({ id: car.id, body: { number, teamName } })
    else {
      if (classId === '') return
      const created = await create.mutateAsync({ seasonId, classId, number, teamName })
      onSaved(created.id)
    }
  }

  const carClass = car ? classes.find((c) => c.id === car.classId) : undefined

  return (
    <div className="rounded-[6px] border border-line bg-surface p-4">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
        {car ? 'Edit Car Entry' : 'New Car Entry'}
      </h2>
      <div className="grid gap-4">
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <Field label="Number">
            <TextInput value={number} onChange={(e) => setNumber(e.target.value)} placeholder="7" />
          </Field>
          <Field label="Team Name">
            <TextInput value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Porsche Penske" />
          </Field>
        </div>
        <Field label="Class" hint={car ? 'Class is fixed after creation.' : undefined}>
          {car ? (
            <div className="flex h-9 items-center gap-2 rounded-[4px] border border-line bg-surface-3 px-3">
              <ClassSwatch hex={classMeta(carClass?.name, carClass?.color).hex} />
              <span className="font-display text-[13px] uppercase text-ink-2">
                {carClass?.name ?? '—'}
              </span>
            </div>
          ) : (
            <Select value={classId} onChange={(e) => setClassId(Number(e.target.value))}>
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {car && (
          <div className="border-t border-line pt-4">
            {roundId && round ? (
              <ImageUpload
                label={`Livery · Round ${String(round.sequence).padStart(2, '0')}`}
                shape="wide"
                uploadPath={`/admin/images/liveries/${roundId}/${car.id}`}
                previewUrl={liveryUrl(roundId, car.id)}
              />
            ) : (
              <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-2">
                Select a round in the topbar to upload a livery
              </div>
            )}
          </div>
        )}
        <div className="flex justify-between">
          {car ? (
            <GhostButton
              onClick={async () => {
                await del.mutateAsync(car.id)
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
          <PrimaryButton
            onClick={save}
            disabled={!number || !teamName || (!car && classId === '') || create.isPending || update.isPending}
          >
            {car ? 'Save' : 'Create'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

// ===================== Drivers =====================
function DriversTab() {
  const [search, setSearch] = useState('')
  const { data: drivers = [] } = useDrivers(search || undefined)
  const [editing, setEditing] = useState<DriverDto | 'new' | null>(null)
  const [bulk, setBulk] = useState(false)

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drivers…"
          className="w-64"
        />
        <div className="flex items-center gap-2">
          <GhostButton
            onClick={() => {
              setBulk((b) => !b)
              setEditing(null)
            }}
          >
            Bulk add
          </GhostButton>
          <PrimaryButton
            onClick={() => {
              setEditing('new')
              setBulk(false)
            }}
          >
            + Add Driver
          </PrimaryButton>
        </div>
      </div>

      {bulk && <DriverBulkGrid onClose={() => setBulk(false)} />}
      {editing && <DriverForm driver={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {drivers.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setEditing(d)}
            className="flex items-center gap-3 rounded-[6px] border border-line bg-surface p-3 text-left hover:border-line-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-[13px] font-bold text-muted">
              {d.fullName
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate font-sans text-[13px] font-semibold text-ink">{d.fullName}</div>
              <div className="font-mono text-[10px] uppercase text-muted-2">{d.country ?? '—'}</div>
            </div>
          </button>
        ))}
        {drivers.length === 0 && <EmptyState>No drivers</EmptyState>}
      </div>
    </div>
  )
}

function DriverForm({ driver, onClose }: { driver: DriverDto | null; onClose: () => void }) {
  const [fullName, setFullName] = useState(driver?.fullName ?? '')
  const [country, setCountry] = useState(driver?.country ?? '')
  const create = useCreateDriver()
  const update = useUpdateDriver()
  const del = useDeleteDriver()

  return (
    <div className="rounded-[6px] border border-line bg-surface p-4">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
        {driver ? 'Edit Driver' : 'New Driver'}
      </h2>
      {driver && (
        <div className="mb-4">
          <ImageUpload
            label="Headshot"
            shape="square"
            uploadPath={`/admin/images/drivers/${driver.id}`}
            previewUrl={headshotUrl(driver.id)}
          />
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Full Name">
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-64" placeholder="Felipe Nasr" />
        </Field>
        <Field label="Country">
          <TextInput value={country} onChange={(e) => setCountry(e.target.value)} className="w-28" placeholder="BRA" />
        </Field>
        <PrimaryButton
          onClick={async () => {
            if (driver) await update.mutateAsync({ id: driver.id, body: { fullName, country: country || null } })
            else await create.mutateAsync({ fullName, country: country || null })
            onClose()
          }}
          disabled={!fullName || create.isPending || update.isPending}
        >
          {driver ? 'Save' : 'Create'}
        </PrimaryButton>
        {driver && (
          <GhostButton
            onClick={async () => {
              await del.mutateAsync(driver.id)
              onClose()
            }}
            className="!text-danger hover:!border-danger/50"
          >
            Delete
          </GhostButton>
        )}
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  )
}

// ===================== Lineups =====================
function LineupsTab({ seasonId }: { seasonId: number }) {
  const { championshipId } = useAdmin()
  const { data: classes = [] } = useAdminClasses(championshipId)
  const { data: cars = [] } = useCarEntries(seasonId)
  const { data: links = [] } = useEntryDrivers()
  const { data: drivers = [] } = useDrivers()
  const createLink = useCreateEntryDriver()
  const deleteLink = useDeleteEntryDriver()
  const [addingTo, setAddingTo] = useState<number | null>(null)

  const carIds = useMemo(() => new Set(cars.map((c) => c.id)), [cars])
  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers])
  const linksByCar = useMemo(() => {
    const m = new Map<number, typeof links>()
    for (const l of links) {
      if (!carIds.has(l.carEntryId)) continue
      const arr = m.get(l.carEntryId) ?? []
      arr.push(l)
      m.set(l.carEntryId, arr)
    }
    return m
  }, [links, carIds])

  const byClass = useMemo(() => {
    const m = new Map<number, CarEntryDto[]>()
    for (const c of cars) {
      const arr = m.get(c.classId) ?? []
      arr.push(c)
      m.set(c.classId, arr)
    }
    return m
  }, [cars])

  if (cars.length === 0) return <EmptyState>No car entries yet — add cars first</EmptyState>

  return (
    <div className="grid gap-5">
      {classes
        .filter((cl) => byClass.has(cl.id))
        .map((cl) => (
          <div key={cl.id} className="rounded-[6px] border border-line bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2">
              <ClassSwatch hex={classMeta(cl.name, cl.color).hex} />
              <span className="font-display text-[13px] font-semibold uppercase text-ink">{cl.name}</span>
              <span className="font-mono text-[10px] text-muted-2">{byClass.get(cl.id)?.length} cars</span>
            </div>
            {byClass.get(cl.id)?.map((car) => {
              const carLinks = linksByCar.get(car.id) ?? []
              return (
                <div key={car.id} className="flex items-start gap-4 border-b border-line px-4 py-3 last:border-b-0">
                  <span className="w-10 shrink-0 font-mono text-[13px] font-semibold text-ink">{car.number}</span>
                  <span className="w-40 shrink-0 font-sans text-[13px] text-ink-2">{car.teamName}</span>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {carLinks.map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-[6px] rounded-[3px] border border-line-2 bg-surface-3 px-2 py-1 font-mono text-[11px] text-ink-2"
                      >
                        {driverById.get(l.driverId)?.fullName ?? `#${l.driverId}`}
                        <button
                          type="button"
                          onClick={() => deleteLink.mutate(l.id)}
                          className="text-muted-2 hover:text-danger"
                          aria-label="Remove driver"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {addingTo === car.id ? (
                      <Select
                        autoFocus
                        defaultValue=""
                        onChange={async (e) => {
                          const driverId = Number(e.target.value)
                          if (driverId) await createLink.mutateAsync({ carEntryId: car.id, driverId })
                          setAddingTo(null)
                        }}
                        onBlur={() => setAddingTo(null)}
                        className="!h-7 w-48"
                      >
                        <option value="">Add driver…</option>
                        {drivers
                          .filter((d) => !carLinks.some((l) => l.driverId === d.id))
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.fullName}
                            </option>
                          ))}
                      </Select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingTo(car.id)}
                        className="rounded-[3px] border border-dashed border-line-2 px-2 py-1 font-mono text-[11px] text-muted-2 hover:text-ink-2"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[10px] uppercase ${
                      carLinks.length > 0 ? 'text-success' : 'text-warn'
                    }`}
                  >
                    {carLinks.length > 0 ? 'Set' : 'Empty'}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
    </div>
  )
}

// ===================== Bulk add =====================

type BulkRowStatus = { ok: boolean; message?: string }
type DriverRow = { fullName: string; country: string }
type CarRow = { number: string; teamName: string }

type BulkColumn<Row> = {
  key: keyof Row & string
  label: string
  placeholder?: string
  /** Tailwind width/flex class for the cell, e.g. 'w-24' or 'flex-1'. */
  width?: string
}

/** Pulls a short message out of a thrown ProblemDetails-ish error. */
function errMessage(reason: unknown): string {
  if (reason && typeof reason === 'object') {
    const p = reason as { detail?: string; title?: string }
    return p.detail ?? p.title ?? 'Failed'
  }
  return 'Failed'
}

function summaryText(created: number, failed: number): string {
  return `Created ${created}${failed ? ` · ${failed} failed` : ''}`
}

/** Turns settled mutation results into the next grid state: succeeded rows drop, failed rows stay with their error. */
function collect<Row>(results: PromiseSettledResult<unknown>[], filled: Row[], blank: Row) {
  let created = 0
  const failedRows: Row[] = []
  const status: Record<number, BulkRowStatus> = {}
  results.forEach((res, idx) => {
    if (res.status === 'fulfilled') created++
    else {
      status[failedRows.length] = { ok: false, message: errMessage(res.reason) }
      failedRows.push(filled[idx])
    }
  })
  return { rows: [...failedRows, { ...blank }], status, created, failed: failedRows.length }
}

/** Spreadsheet-style grid that always keeps one trailing blank row (no "add row" click needed). */
function BulkGrid<Row extends Record<string, string>>({
  columns,
  rows,
  onChange,
  blank,
  status,
}: {
  columns: BulkColumn<Row>[]
  rows: Row[]
  onChange: (rows: Row[]) => void
  blank: Row
  status?: Record<number, BulkRowStatus>
}) {
  const isBlank = (r: Row) => columns.every((c) => (r[c.key] ?? '').trim() === '')

  const normalize = (next: Row[]): Row[] => {
    const out = [...next]
    while (out.length > 1 && isBlank(out[out.length - 1]) && isBlank(out[out.length - 2])) out.pop()
    if (out.length === 0 || !isBlank(out[out.length - 1])) out.push({ ...blank })
    return out
  }

  const setCell = (i: number, key: keyof Row, value: string) =>
    onChange(normalize(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r))))

  const removeRow = (i: number) => onChange(normalize(rows.filter((_, idx) => idx !== i)))

  return (
    <div className="overflow-hidden rounded-[4px] border border-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
        <span className="w-6 shrink-0" />
        {columns.map((c) => (
          <span
            key={c.key}
            className={`font-mono text-[9px] tracking-[0.12em] uppercase text-muted-2 ${c.width ?? 'flex-1'}`}
          >
            {c.label}
          </span>
        ))}
        <span className="w-44 shrink-0" />
      </div>
      {rows.map((r, i) => {
        const st = status?.[i]
        const last = i === rows.length - 1
        return (
          <div key={i} className="flex items-center gap-2 border-b border-line px-3 py-[5px] last:border-b-0">
            <span className="w-6 shrink-0 text-right font-mono text-[10px] text-muted-2">{i + 1}</span>
            {columns.map((c) => (
              <div key={c.key} className={c.width ?? 'flex-1'}>
                <TextInput
                  value={r[c.key]}
                  onChange={(e) => setCell(i, c.key, e.target.value)}
                  placeholder={c.placeholder}
                  className="!h-8"
                />
              </div>
            ))}
            <div className="flex w-44 shrink-0 items-center justify-end gap-2">
              {st && (
                <span className={`font-mono text-[10px] ${st.ok ? 'text-success' : 'text-danger'}`}>
                  {st.ok ? '✓ added' : st.message}
                </span>
              )}
              {!isBlank(r) && !last && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Remove row"
                  className="font-mono text-[14px] leading-none text-muted-2 hover:text-danger"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Shared panel chrome for a bulk-add grid: title, summary, and a Create N / Close footer. */
function BulkPanel({
  title,
  count,
  pending,
  submitDisabled,
  summary,
  onSubmit,
  onClose,
  children,
}: {
  title: string
  count: number
  pending: boolean
  submitDisabled?: boolean
  summary: string | null
  onSubmit: () => void
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[6px] border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">{title}</h2>
        {summary && <span className="font-mono text-[11px] text-muted">{summary}</span>}
      </div>
      {children}
      <div className="mt-3 flex items-center justify-end gap-2">
        <GhostButton onClick={onClose}>Close</GhostButton>
        <PrimaryButton onClick={onSubmit} disabled={count === 0 || pending || submitDisabled}>
          Create {count}
        </PrimaryButton>
      </div>
    </div>
  )
}

function DriverBulkGrid({ onClose }: { onClose: () => void }) {
  const blank: DriverRow = { fullName: '', country: '' }
  const [rows, setRows] = useState<DriverRow[]>([{ ...blank }])
  const [status, setStatus] = useState<Record<number, BulkRowStatus>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const create = useCreateDriver()

  const filled = rows.filter((r) => r.fullName.trim() !== '')

  const handleChange = (next: DriverRow[]) => {
    setRows(next)
    setStatus({})
    setSummary(null)
  }

  const submit = async () => {
    const results = await Promise.allSettled(
      filled.map((r) => create.mutateAsync({ fullName: r.fullName.trim(), country: r.country.trim() || null })),
    )
    const c = collect(results, filled, blank)
    setRows(c.rows)
    setStatus(c.status)
    setSummary(summaryText(c.created, c.failed))
  }

  return (
    <BulkPanel
      title="Bulk Add Drivers"
      count={filled.length}
      pending={create.isPending}
      summary={summary}
      onSubmit={submit}
      onClose={onClose}
    >
      <BulkGrid
        columns={[
          { key: 'fullName', label: 'Full Name', placeholder: 'Felipe Nasr', width: 'flex-[2]' },
          { key: 'country', label: 'Country', placeholder: 'BRA', width: 'w-28' },
        ]}
        rows={rows}
        onChange={handleChange}
        blank={blank}
        status={status}
      />
    </BulkPanel>
  )
}

function CarEntryBulkGrid({
  seasonId,
  classes,
  onClose,
}: {
  seasonId: number
  classes: { id: number; name: string; color?: string | null }[]
  onClose: () => void
}) {
  const blank: CarRow = { number: '', teamName: '' }
  const [rows, setRows] = useState<CarRow[]>([{ ...blank }])
  const [classId, setClassId] = useState<number | ''>('')
  const [status, setStatus] = useState<Record<number, BulkRowStatus>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const create = useCreateCarEntry()

  const filled = rows.filter((r) => r.number.trim() !== '' && r.teamName.trim() !== '')

  const handleChange = (next: CarRow[]) => {
    setRows(next)
    setStatus({})
    setSummary(null)
  }

  const submit = async () => {
    if (classId === '') return
    const results = await Promise.allSettled(
      filled.map((r) =>
        create.mutateAsync({ seasonId, classId, number: r.number.trim(), teamName: r.teamName.trim() }),
      ),
    )
    const c = collect(results, filled, blank)
    setRows(c.rows)
    setStatus(c.status)
    setSummary(summaryText(c.created, c.failed))
  }

  return (
    <BulkPanel
      title="Bulk Add Car Entries"
      count={filled.length}
      pending={create.isPending}
      submitDisabled={classId === ''}
      summary={summary}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="mb-3 flex items-end gap-2">
        <div className="max-w-xs flex-1">
          <Field label="Class (applies to all rows)">
            <Select
              value={classId}
              onChange={(e) => setClassId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {classId !== '' && (
          <ClassSwatch hex={classMeta(classes.find((c) => c.id === classId)?.name, classes.find((c) => c.id === classId)?.color).hex} />
        )}
      </div>
      <BulkGrid
        columns={[
          { key: 'number', label: 'Number', placeholder: '7', width: 'w-24' },
          { key: 'teamName', label: 'Team Name', placeholder: 'Porsche Penske', width: 'flex-1' },
        ]}
        rows={rows}
        onChange={handleChange}
        blank={blank}
        status={status}
      />
    </BulkPanel>
  )
}
