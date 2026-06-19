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
  const selected = cars.find((c) => c.id === sel) ?? null

  const driverCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const l of links) m.set(l.carEntryId, (m.get(l.carEntryId) ?? 0) + 1)
    return m
  }, [links])

  return (
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
          <GhostButton onClick={() => setSel(null)} className="ml-auto">
            + New
          </GhostButton>
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

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drivers…"
          className="w-64"
        />
        <PrimaryButton onClick={() => setEditing('new')}>+ Add Driver</PrimaryButton>
      </div>

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
