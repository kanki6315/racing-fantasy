import { useMemo, useState } from 'react'
import { useAdmin } from '../../admin/AdminContext'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { GhostButton, TextInput, EmptyState } from '../../admin/ui'
import { Demo } from '../../components/Demo'
import { useAdminRegistrations } from '../../api/adminQueries'
import { demoStats } from '../../lib/demoStats'

function toCsv(rows: { teamName: string; userId: number | null; id: number }[]): string {
  const head = 'registration_id,team_name,user_id'
  const body = rows.map((r) => `${r.id},"${r.teamName.replace(/"/g, '""')}",${r.userId ?? ''}`)
  return [head, ...body].join('\n')
}

export function Registrations() {
  const { seasonId, season } = useAdmin()
  const { data: regs = [] } = useAdminRegistrations(seasonId)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? regs.filter((r) => r.teamName.toLowerCase().includes(q)) : regs
  }, [regs, search])

  const exportCsv = () => {
    const blob = new Blob([toCsv(regs)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registrations-season-${seasonId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!seasonId) return <EmptyState>Select a season in the topbar</EmptyState>

  return (
    <>
      <AdminPageHeader
        title="Registrations"
        subtitle={`Per season · ${season?.year ?? ''} — team name is the only public identifier (ADR-0004).`}
        actions={
          <GhostButton onClick={exportCsv} disabled={regs.length === 0}>
            Export CSV
          </GhostButton>
        }
      />

      {/* Summary tiles */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Registered" value={String(regs.length)} note="this season" />
        <Tile
          label="Picks Set"
          value={<Demo>{demoStats.registrations.picksSetPct}%</Demo>}
          note="submitted (demo)"
        />
        <Tile
          label="Private Leagues"
          value={<Demo>{demoStats.registrations.privateLeagues}</Demo>}
          note="this season (demo)"
        />
      </div>

      <div className="rounded-[6px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
            {filtered.length} of {regs.length}
          </span>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team…"
            className="w-56"
          />
        </div>

        {regs.length === 0 ? (
          <div className="p-4">
            <EmptyState>No registrations for this season</EmptyState>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_8rem_6rem]">
            <div className="contents font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
              <div className="border-b border-line px-4 py-2">Team (public)</div>
              <div className="border-b border-line px-4 py-2">User</div>
              <div className="border-b border-line px-4 py-2 text-right">Reg ID</div>
            </div>
            {filtered.map((r) => (
              <div key={r.id} className="contents">
                <div className="flex items-center border-b border-line px-4 py-3 font-display text-[14px] font-semibold uppercase tracking-[0.02em] text-ink">
                  {r.teamName}
                </div>
                <div className="flex items-center border-b border-line px-4 py-3 font-mono text-[12px] text-muted">
                  {r.userId != null ? `U-${String(r.userId).padStart(5, '0')}` : '— erased —'}
                </div>
                <div className="flex items-center justify-end border-b border-line px-4 py-3 font-mono text-[12px] text-muted-2">
                  {r.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-[6px] border border-line bg-surface px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">{label}</div>
      <div className="mt-1 font-mono text-[22px] text-ink">{value}</div>
      <div className="font-sans text-[11px] text-muted">{note}</div>
    </div>
  )
}
