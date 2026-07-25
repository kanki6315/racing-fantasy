import { useState } from 'react'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { Field, TextInput, PrimaryButton, GhostButton, ListRow, EmptyState } from '../../admin/ui'
import {
  useAdminEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  type EventDto,
} from '../../api/adminQueries'
import { deriveEventStatus, EVENT_STATUS_META } from '../../lib/eventStatus'

// datetime-local <-> ISO (mirrors Catalog's helpers; kept local to avoid a shared-export churn).
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localInputToIso(v: string): string | null {
  return v ? new Date(v).toISOString() : null
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Shared events (ADR-0007). An event is a physical race weekend many championships opt into — each
 * via its own round (attached on the Catalog → Rounds form). This screen is cross-championship, so
 * it lives outside the championship/season-scoped Catalog tabs.
 */
export function Events() {
  const { data: events = [], isLoading, isError } = useAdminEvents()
  const [sel, setSel] = useState<number | null>(null)
  const selected = events.find((e) => e.id === sel) ?? null

  return (
    <>
      <AdminPageHeader
        title="Events"
        subtitle="Shared race weekends. Create the weekend once here; each championship opts in by linking a round to it under Catalog → Rounds."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[6px] border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted">
              {events.length} events
            </span>
            <GhostButton onClick={() => setSel(null)}>+ New</GhostButton>
          </div>
          {isLoading ? (
            <div className="p-4">
              <EmptyState>Loading events…</EmptyState>
            </div>
          ) : isError ? (
            <div className="p-4">
              <EmptyState>Couldn’t load events</EmptyState>
            </div>
          ) : events.length === 0 ? (
            <div className="p-4">
              <EmptyState>No events yet</EmptyState>
            </div>
          ) : (
            events.map((ev) => (
              <ListRow key={ev.id} selected={ev.id === sel} onClick={() => setSel(ev.id)}>
                <div className="flex-1">
                  <div className="font-display text-[14px] font-semibold uppercase text-ink">{ev.name}</div>
                  <div className="font-mono text-[10px] text-muted">
                    {ev.circuit ?? '—'} · {fmtDate(ev.startsAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const m = EVENT_STATUS_META[deriveEventStatus(ev)]
                    return (
                      <span className={`rounded-[2px] border px-[7px] py-[2px] font-display text-[9px] font-semibold uppercase tracking-[0.08em] ${m.className}`}>
                        {m.label}
                      </span>
                    )
                  })()}
                  <span className="font-mono text-[11px] text-ink-2">{ev.rounds.length} series</span>
                </div>
              </ListRow>
            ))
          )}
        </div>
        <EventForm key={selected?.id ?? 'new'} event={selected} onSaved={setSel} />
      </div>
    </>
  )
}

function EventForm({ event, onSaved }: { event: EventDto | null; onSaved: (id: number | null) => void }) {
  const [name, setName] = useState(event?.name ?? '')
  const [circuit, setCircuit] = useState(event?.circuit ?? '')
  const [startsAt, setStartsAt] = useState(isoToLocalInput(event?.startsAt))
  const [endsAt, setEndsAt] = useState(isoToLocalInput(event?.endsAt))
  const [picksOpen, setPicksOpen] = useState(event?.picksOpen ?? false)
  const [scored, setScored] = useState(event?.scored ?? false)
  const [finalized, setFinalized] = useState(event?.finalized ?? false)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const del = useDeleteEvent()

  const save = async () => {
    setError(null)
    const body = {
      name,
      circuit: circuit || null,
      startsAt: localInputToIso(startsAt),
      endsAt: localInputToIso(endsAt),
      picksOpen,
      scored,
      finalized,
    }
    try {
      if (event) await update.mutateAsync({ id: event.id, body })
      else {
        const created = await create.mutateAsync(body)
        onSaved(created.id)
      }
    } catch {
      setError('Couldn’t save this event.')
    }
  }

  const remove = async () => {
    if (!event) return
    setError(null)
    try {
      await del.mutateAsync(event.id)
      onSaved(null)
    } catch {
      // The API rejects deletes while rounds are still attached (ADR-0007 delete guard).
      setError('Detach all rounds from this event before deleting it.')
    }
  }

  return (
    <div className="rounded-[6px] border border-line bg-surface p-4">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.14em] uppercase text-muted">
        {event ? 'Edit Event' : 'New Event'}
      </h2>
      <div className="grid gap-4">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Sebring" />
        </Field>
        <Field label="Circuit">
          <TextInput
            value={circuit}
            onChange={(e) => setCircuit(e.target.value)}
            placeholder="Sebring International Raceway"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weekend Start">
            <TextInput type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Weekend End">
            <TextInput type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>

        <Field label="Picks">
          <button
            type="button"
            role="switch"
            aria-checked={picksOpen}
            onClick={() => setPicksOpen((v) => !v)}
            className={`inline-flex h-8 items-center gap-2 rounded-[3px] border px-3 font-display text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors cursor-pointer ${
              picksOpen ? 'border-brand/50 bg-brand/10 text-brand-3' : 'border-line-2 text-muted hover:text-ink-2'
            }`}
          >
            <span className={`h-[8px] w-[8px] rounded-full ${picksOpen ? 'bg-brand' : 'bg-line-2'}`} />
            {picksOpen ? 'Open for picks' : 'Closed'}
          </button>
          <p className="mt-1 font-sans text-[11px] text-muted">
            Releases the pick board for every series this weekend at once. Picks still lock per round at qualifying.
          </p>
        </Field>

        <Field label="Lifecycle">
          <div className="flex flex-wrap gap-2">
            <LifecycleSwitch
              on={scored}
              onToggle={() => setScored((v) => !v)}
              onLabel="Scored"
              offLabel="Not scored"
            />
            <LifecycleSwitch
              on={finalized}
              onToggle={() => setFinalized((v) => !v)}
              onLabel="Finalized"
              offLabel="Not finalized"
            />
          </div>
          <p className="mt-1 font-sans text-[11px] text-muted">
            <span className="text-ink-2">Scored</span> shows a Scored badge so players can review locked picks (does not
            gate standings). <span className="text-ink-2">Finalized</span> closes the weekend — it drops off the player
            dashboard. Flip Scored once every series' results are in.
          </p>
        </Field>

        {event && (
          <div className="border-t border-line pt-4">
            <div className="mb-2 font-mono text-[9px] tracking-[0.12em] uppercase text-muted">
              Participating Championships
            </div>
            {event.rounds.length === 0 ? (
              <span className="font-sans text-[12px] text-muted">
                No rounds linked yet — link one under Catalog → Rounds.
              </span>
            ) : (
              <div className="grid gap-1.5">
                {event.rounds.map((r) => (
                  <div
                    key={r.roundId}
                    className="flex items-center justify-between rounded-[3px] border border-line-2 bg-surface-3 px-3 py-1.5"
                  >
                    <span className="font-display text-[12px] font-semibold uppercase text-ink-2">
                      {r.championshipName}
                    </span>
                    <span className="font-mono text-[10px] text-muted">
                      {r.year} · {r.roundName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <div className="font-mono text-[11px] text-danger">{error}</div>}

        <div className="flex justify-between">
          {event ? (
            <GhostButton onClick={remove} disabled={del.isPending} className="!text-danger hover:!border-danger/50">
              Delete
            </GhostButton>
          ) : (
            <span />
          )}
          <PrimaryButton onClick={save} disabled={!name || create.isPending || update.isPending}>
            {event ? 'Save' : 'Create'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

// A toggle for the manual lifecycle flags (scored/finalized), styled to match the Picks switch above.
function LifecycleSwitch({
  on, onToggle, onLabel, offLabel,
}: { on: boolean; onToggle: () => void; onLabel: string; offLabel: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`inline-flex h-8 items-center gap-2 rounded-[3px] border px-3 font-display text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors cursor-pointer ${
        on ? 'border-brand/50 bg-brand/10 text-brand-3' : 'border-line-2 text-muted hover:text-ink-2'
      }`}
    >
      <span className={`h-[8px] w-[8px] rounded-full ${on ? 'bg-brand' : 'bg-line-2'}`} />
      {on ? onLabel : offLabel}
    </button>
  )
}
