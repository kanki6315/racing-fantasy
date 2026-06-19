import { useAdmin } from '../../admin/AdminContext'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { useAdminClasses, useCarEntries, useAdminSessions } from '../../api/adminQueries'
import { usePrices } from '../../api/queries'
import { useCountdown } from '../../lib/useCountdown'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso)
    .toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .toUpperCase()
}

type StepState = 'done' | 'active' | 'todo'

function PipelineStep({
  n,
  label,
  detail,
  state,
}: {
  n: number
  label: string
  detail: string
  state: StepState
}) {
  const ring =
    state === 'done'
      ? 'border-success/50 text-success'
      : state === 'active'
        ? 'border-brand text-brand-3'
        : 'border-line-2 text-muted-2'
  return (
    <div className="flex items-center gap-3 rounded-[5px] border border-line bg-surface px-4 py-3">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[11px] ${ring}`}>
        {state === 'todo' ? '○' : String(n).padStart(2, '0')}
      </div>
      <div className="min-w-0">
        <div className="font-display text-[13px] font-semibold uppercase tracking-[0.03em] text-ink-2">{label}</div>
        <div className="font-mono text-[10px] tracking-[0.04em] text-muted">{detail}</div>
      </div>
    </div>
  )
}

export function AdminOverview() {
  const { championshipId, seasonId, round } = useAdmin()
  const { data: classes = [] } = useAdminClasses(championshipId)
  const { data: cars = [] } = useCarEntries(seasonId)
  const { data: sessions = [] } = useAdminSessions(round?.id)
  const { data: prices = [] } = usePrices(round?.id ?? 0)
  const lock = useCountdown(round?.qualiStart)

  const pricedCount = prices.length
  const entityCount = cars.length // cars priced; drivers add to this once lineups exist
  const unpriced = Math.max(entityCount - pricedCount, 0)

  const steps: { n: number; label: string; detail: string; state: StepState }[] = [
    {
      n: 1,
      label: 'Catalog',
      detail: classes.length ? `${classes.length} classes set` : 'no classes',
      state: classes.length ? 'done' : 'active',
    },
    {
      n: 2,
      label: 'Entries',
      detail: cars.length ? `${cars.length} cars imported` : 'none imported',
      state: cars.length ? 'done' : 'active',
    },
    {
      n: 3,
      label: 'Prices',
      detail: unpriced ? `${unpriced} unpriced` : pricedCount ? 'all priced' : 'not set',
      state: pricedCount && !unpriced ? 'done' : 'active',
    },
    {
      n: 4,
      label: 'Sessions',
      detail: sessions.length ? `${sessions.length} scheduled` : 'none',
      state: sessions.length ? 'done' : 'todo',
    },
    { n: 5, label: 'Results', detail: 'awaiting ingest', state: 'todo' },
    { n: 6, label: 'Scoring', detail: 'not run', state: 'todo' },
    { n: 7, label: 'Publish', detail: 'gated', state: 'todo' },
  ]

  return (
    <>
      <AdminPageHeader
        title="Round Overview"
        subtitle={
          round
            ? `RD ${String(round.sequence).padStart(2, '0')} · ${round.circuit ?? round.name} · all setup tasks for this round in one place`
            : 'Select a round from the topbar to begin.'
        }
      />

      {!round ? (
        <div className="rounded-[6px] border border-line bg-surface p-8 text-center font-mono text-[12px] tracking-[0.08em] uppercase text-muted-2">
          No round selected
        </div>
      ) : (
        <div className="grid gap-5">
          {/* Player lock card */}
          <div className="flex items-center justify-between rounded-[6px] border border-brand/30 bg-brand/[0.06] px-5 py-4">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" stroke="#ffc23d" strokeWidth="2" />
                <path d="M8 11V8a4 4 0 018 0v3" stroke="#ffc23d" strokeWidth="2" />
              </svg>
              <div>
                <div className="font-display text-[14px] font-semibold uppercase tracking-[0.04em] text-ink">
                  Player Lock · Qualifying Start
                </div>
                <div className="font-mono text-[11px] tracking-[0.04em] text-muted">
                  {fmtDate(round.qualiStart)} · lineups lock for all players when qualifying begins
                </div>
              </div>
            </div>
            <div className={`font-mono text-[15px] font-medium ${lock.locked ? 'text-danger' : 'text-warn'}`}>
              {lock.locked ? 'LOCKED' : `${lock.text} remaining`}
            </div>
          </div>

          {/* Setup pipeline */}
          <div>
            <div className="mb-3 font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
              Round Setup Pipeline
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {steps.map((s) => (
                <PipelineStep key={s.n} {...s} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
