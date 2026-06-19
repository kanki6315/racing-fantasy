import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth/AuthContext'
import { useCountdown } from '../lib/useCountdown'
import { AdminProvider, useAdmin } from './AdminContext'

const consoleNav = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/catalog', label: 'Catalog' },
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/entries', label: 'Entries' },
  { to: '/admin/prices', label: 'Prices' },
  { to: '/admin/results', label: 'Results' },
  { to: '/admin/scoring', label: 'Scoring' },
]
const governanceNav = [
  { to: '/admin/registrations', label: 'Registrations' },
  { to: '/admin/users', label: 'Users & Data' },
]

/** A dark, broadcast-styled native select used for the topbar championship/season/round context. */
function ContextSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: number | undefined
  onChange: (id: number) => void
  options: { id: number; label: string }[]
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-muted-2">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 rounded-[3px] border border-line-2 bg-surface-3 px-2 font-display text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-2 hover:border-line-3 focus:border-brand focus:outline-none cursor-pointer"
      >
        {options.length === 0 && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function AdminTopbar() {
  const { user } = useAuth()
  const ctx = useAdmin()
  const lock = useCountdown(ctx.round?.qualiStart)

  const initials = (user?.name ?? user?.email ?? 'A')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex h-14 items-center justify-between border-b-2 border-brand bg-black px-[26px]">
      <div className="flex items-center gap-5">
        <Logo />
        <span className="flex items-center gap-[5px] rounded-[3px] border border-brand/40 bg-brand/10 px-2 py-[3px]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" stroke="#ff5d5d" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-[11px] font-bold tracking-[0.1em] text-brand-3">ADMIN</span>
        </span>
        <div className="ml-2 flex items-center gap-4">
          <ContextSelect
            label="Champ"
            value={ctx.championshipId}
            onChange={ctx.setChampionshipId}
            options={ctx.championships.map((c) => ({ id: c.id, label: c.name }))}
          />
          <ContextSelect
            label="Season"
            value={ctx.seasonId}
            onChange={ctx.setSeasonId}
            options={ctx.seasons.map((s) => ({ id: s.id, label: String(s.year) }))}
          />
          <ContextSelect
            label="Round"
            value={ctx.roundId}
            onChange={ctx.setRoundId}
            options={ctx.rounds.map((r) => ({ id: r.id, label: `${String(r.sequence).padStart(2, '0')} · ${r.name}` }))}
          />
        </div>
      </div>

      <div className="flex items-center gap-5">
        <span className="flex items-center gap-[6px]">
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted-2">Player Lock</span>
          <span className={`font-mono text-[12px] font-medium ${lock.locked ? 'text-danger' : 'text-warn'}`}>
            {lock.text}
          </span>
        </span>
        <div className="flex items-center gap-[10px]">
          <div className="text-right leading-tight">
            <div className="font-sans text-[12px] font-semibold text-ink">{user?.name ?? 'Admin'}</div>
            <div className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted-2">League Operator</div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 font-display text-[12px] font-bold text-ink-2">
            {initials}
          </div>
        </div>
      </div>
    </div>
  )
}

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'relative flex h-9 items-center rounded-[4px] pl-4 pr-3 font-display text-[13px] font-semibold uppercase tracking-[0.04em] transition-colors',
    isActive
      ? 'bg-surface-2 text-ink before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-brand'
      : 'text-muted hover:text-ink-2',
  ].join(' ')
}

function AdminSidebar() {
  return (
    <aside className="flex w-[212px] shrink-0 flex-col border-r border-line bg-surface-3">
      <nav className="flex flex-1 flex-col gap-[2px] px-3 py-5">
        <div className="px-1 pb-2 font-mono text-[9px] tracking-[0.16em] uppercase text-muted-2">Console</div>
        {consoleNav.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
            {l.label}
          </NavLink>
        ))}
        <div className="px-1 pb-2 pt-5 font-mono text-[9px] tracking-[0.16em] uppercase text-muted-2">Governance</div>
        {governanceNav.map((l) => (
          <NavLink key={l.to} to={l.to} className={navClass}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <span className="h-[6px] w-[6px] rounded-full bg-success" />
        <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted-2">API · all systems go</span>
      </div>
    </aside>
  )
}

/** The admin console chrome: broadcast topbar + Console/Governance sidebar, with the routed page. */
export function AdminLayout() {
  return (
    <AdminProvider>
      <div className="flex min-h-screen flex-col bg-bg">
        <AdminTopbar />
        <div className="flex flex-1">
          <AdminSidebar />
          <main className="min-w-0 flex-1 px-7 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminProvider>
  )
}
