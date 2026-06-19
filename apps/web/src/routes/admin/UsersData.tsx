import { useMemo, useState } from 'react'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { GhostButton, PrimaryButton, TextInput, EmptyState } from '../../admin/ui'
import { useUsers, useDeleteUser, fetchUserExport, type UserDto } from '../../api/adminQueries'

const uid = (id: number) => `U-${String(id).padStart(5, '0')}`

function fmtDate(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}

export function UsersData() {
  const { data: users = [] } = useUsers()
  const [search, setSearch] = useState('')
  const [erasing, setErasing] = useState<UserDto | null>(null)
  const [exportingId, setExportingId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? users.filter((u) => uid(u.id).toLowerCase().includes(q)) : users
  }, [users, search])

  const exportUser = async (id: number) => {
    setExportingId(id)
    try {
      const data = await fetchUserExport(id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pii-export-${uid(id)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingId(null)
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Users & Data"
        subtitle="Data-subject rights (ADR-0004): access export and right-to-erasure."
        actions={
          <span className="flex items-center gap-[6px] rounded-[3px] border border-success/40 bg-success/10 px-2 py-1">
            <span className="h-[6px] w-[6px] rounded-full bg-success" />
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-success">PII Protected</span>
          </span>
        }
      />

      {/* Visibility tiers legend */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[6px] border border-line bg-surface px-5 py-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">Visibility</span>
        <Tier color="bg-success" code="team_name" desc="public — the leaderboard identity" />
        <Tier color="bg-warn" code="name" desc="private-league members only" />
        <Tier color="bg-danger" code="email" desc="holder-only · never shown here" />
      </div>

      <div className="rounded-[6px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-2">
            {filtered.length} of {users.length} users
          </span>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user id…"
            className="w-56"
          />
        </div>

        {users.length === 0 ? (
          <div className="p-4">
            <EmptyState>No users</EmptyState>
          </div>
        ) : (
          <div className="grid grid-cols-[7rem_6rem_7rem_6rem_1fr]">
            <div className="contents font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
              <div className="border-b border-line px-4 py-2">User ID</div>
              <div className="border-b border-line px-4 py-2">Provider</div>
              <div className="border-b border-line px-4 py-2">Joined</div>
              <div className="border-b border-line px-4 py-2 text-right">Regs</div>
              <div className="border-b border-line px-4 py-2 text-right">Actions</div>
            </div>
            {filtered.map((u) => (
              <div key={u.id} className="contents">
                <div className="flex items-center border-b border-line px-4 py-3 font-mono text-[12px] text-ink">
                  {uid(u.id)}
                </div>
                <div className="flex items-center border-b border-line px-4 py-3 font-mono text-[11px] uppercase text-muted">
                  {u.externalProvider}
                </div>
                <div className="flex items-center border-b border-line px-4 py-3 font-mono text-[12px] text-muted-2">
                  {fmtDate(u.createdAt)}
                </div>
                <div className="flex items-center justify-end border-b border-line px-4 py-3 font-mono text-[12px] text-muted-2">
                  {u.registrationCount}
                </div>
                <div className="flex items-center justify-end gap-2 border-b border-line px-4 py-3">
                  <button
                    type="button"
                    onClick={() => exportUser(u.id)}
                    disabled={exportingId === u.id}
                    className="font-mono text-[11px] uppercase text-success/80 hover:text-success disabled:opacity-50"
                  >
                    {exportingId === u.id ? 'Exporting…' : 'Export'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setErasing(u)}
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

      {erasing && <EraseDialog user={erasing} onClose={() => setErasing(null)} />}
    </>
  )
}

function Tier({ color, code, desc }: { color: string; code: string; desc: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-[6px] w-[6px] rounded-full ${color}`} />
      <span className="font-mono text-[11px] text-ink-2">{code}</span>
      <span className="font-sans text-[11px] text-muted">{desc}</span>
    </span>
  )
}

function EraseDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const del = useDeleteUser()
  const [confirm, setConfirm] = useState('')
  const phrase = `ERASE ${uid(user.id)}`
  const armed = confirm.trim() === phrase

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[8px] border border-danger/50 bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-t-[3px] border-danger px-5 pt-4">
          <h2 className="font-display text-[18px] font-bold italic uppercase text-ink">Erase User Data</h2>
          <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-danger">
            Irreversible · Right to Erasure
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="mb-3 rounded-[5px] border border-line bg-surface-3 px-3 py-2 font-mono text-[12px] text-ink">
            {uid(user.id)} · {user.registrationCount} registration{user.registrationCount === 1 ? '' : 's'}
          </div>
          <ul className="mb-4 grid gap-1 font-sans text-[12px] text-muted">
            <li>
              <span className="text-danger">✕</span> Purges <span className="text-warn">name</span> &amp;{' '}
              <span className="text-danger">email</span>, deletes the account
            </li>
            <li>
              <span className="text-danger">✕</span> Anonymizes <span className="text-success">team_name</span> →
              "Retired Team #id", detaches picks
            </li>
            <li>
              <span className="text-success">✓</span> Keeps anonymized scoring/leaderboard history
            </li>
          </ul>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
            Type <span className="text-ink-2">{phrase}</span> to confirm
          </label>
          <TextInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={phrase}
            autoFocus
            className="font-mono"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton
            onClick={async () => {
              await del.mutateAsync(user.id)
              onClose()
            }}
            disabled={!armed || del.isPending}
            className="!bg-danger hover:!bg-brand-3"
          >
            {del.isPending ? 'Erasing…' : 'Erase'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
