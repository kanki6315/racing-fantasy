import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useCreateLeague, useJoinByCode } from '../api/queries'

const overlay = 'fixed inset-0 z-50 bg-[rgba(4,5,6,0.78)] backdrop-blur-[3px]'
const content =
  'fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[6px] border border-line-2 bg-surface-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] focus:outline-none'

export function CreateLeagueModal({
  seasonId,
  open,
  onOpenChange,
}: {
  seasonId: number
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<'Public' | 'Private'>('Private')
  const create = useCreateLeague()
  const [created, setCreated] = useState<{ name: string; joinCode: string | null } | null>(null)

  const valid = name.trim().length >= 3 && name.trim().length <= 50
  const submit = async () => {
    if (!valid || create.isPending) return
    try {
      const league = await create.mutateAsync({ seasonId, name: name.trim(), visibility })
      setCreated({ name: league.name, joinCode: league.joinCode })
    } catch {
      /* shown below */
    }
  }
  const close = () => {
    onOpenChange(false)
    setTimeout(() => { setName(''); setCreated(null) }, 200)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !create.isPending && (v ? onOpenChange(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content className={content}>
          <div className="h-1 bg-gradient-to-r from-brand to-brand-3" />
          <div className="p-7">
            {created ? (
              <>
                <Dialog.Title className="font-display text-[24px] font-extrabold italic uppercase text-ink">League created</Dialog.Title>
                <p className="mt-2 font-sans text-[13px] text-muted">
                  <span className="text-ink-2">{created.name}</span> is live. Your picks are scored into it automatically.
                </p>
                {created.joinCode && (
                  <div className="mt-4 rounded-[4px] border border-line bg-[#070809] p-4">
                    <div className="font-display text-[10px] tracking-[0.14em] uppercase text-muted-2">Invite code</div>
                    <div className="mt-1 font-mono text-[22px] font-bold tracking-[0.1em] text-ink">{created.joinCode}</div>
                    <div className="mt-1 font-sans text-[12px] text-muted">Share this so friends can join your private league.</div>
                  </div>
                )}
                <button onClick={close} className="mt-5 h-11 w-full rounded-[3px] bg-brand font-display text-[15px] font-bold italic uppercase tracking-[0.05em] text-ink cursor-pointer">
                  Done
                </button>
              </>
            ) : (
              <>
                <Dialog.Title className="font-display text-[24px] font-extrabold italic uppercase text-ink">Create a league</Dialog.Title>
                <Dialog.Description className="mt-2 font-sans text-[13px] text-muted">
                  A private group ranked on the same picks you already make.
                </Dialog.Description>

                <label className="mt-5 mb-[7px] block font-display text-[12px] font-semibold tracking-[0.1em] uppercase text-ink-2">League name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  autoFocus
                  placeholder="e.g. No Lift Crew"
                  className="h-12 w-full rounded-[4px] border border-line-2 bg-[#070809] px-[15px] font-display text-[18px] font-bold text-ink outline-none placeholder:text-line-3"
                />

                <div className="mt-4 flex gap-2">
                  {(['Private', 'Public'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisibility(v)}
                      className={`flex-1 rounded-[3px] border py-2 font-display text-[13px] font-semibold uppercase tracking-[0.04em] cursor-pointer ${
                        visibility === v ? 'border-brand text-ink' : 'border-line-2 text-muted'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p className="mt-2 font-sans text-[12px] text-muted-2">
                  {visibility === 'Private' ? 'Invite-only via a join code.' : 'Anyone can find and join from Discover.'}
                </p>

                {create.isError && <p className="mt-3 font-sans text-[12px] text-danger">Couldn't create the league — try another name.</p>}

                <div className="mt-5 flex gap-3">
                  <Dialog.Close className="h-11 rounded-[3px] border border-line-2 px-5 font-display text-[14px] font-semibold uppercase text-ink-2 cursor-pointer">Cancel</Dialog.Close>
                  <button
                    onClick={submit}
                    disabled={!valid || create.isPending}
                    className={`h-11 flex-1 rounded-[3px] font-display text-[15px] font-bold italic uppercase tracking-[0.05em] text-ink ${
                      valid ? 'bg-brand cursor-pointer' : 'bg-[#3a1614] opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {create.isPending ? 'Creating…' : 'Create League'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function JoinByCodeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [code, setCode] = useState('')
  const join = useJoinByCode()
  const valid = code.trim().length > 0

  const submit = async () => {
    if (!valid || join.isPending) return
    try {
      await join.mutateAsync(code.trim())
      onOpenChange(false)
      setTimeout(() => setCode(''), 200)
    } catch {
      /* shown below */
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !join.isPending && onOpenChange(v)}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content className={content}>
          <div className="h-1 bg-gradient-to-r from-brand to-brand-3" />
          <div className="p-7">
            <Dialog.Title className="font-display text-[24px] font-extrabold italic uppercase text-ink">Join with code</Dialog.Title>
            <Dialog.Description className="mt-2 font-sans text-[13px] text-muted">
              Enter the invite code for a private league.
            </Dialog.Description>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
              placeholder="ABCD1234"
              className="mt-5 h-12 w-full rounded-[4px] border border-line-2 bg-[#070809] px-[15px] font-mono text-[18px] font-bold tracking-[0.1em] text-ink outline-none placeholder:text-line-3"
            />
            {join.isError && <p className="mt-3 font-sans text-[12px] text-danger">That code didn't match a league (or you're already in / not registered).</p>}
            <div className="mt-5 flex gap-3">
              <Dialog.Close className="h-11 rounded-[3px] border border-line-2 px-5 font-display text-[14px] font-semibold uppercase text-ink-2 cursor-pointer">Cancel</Dialog.Close>
              <button
                onClick={submit}
                disabled={!valid || join.isPending}
                className={`h-11 flex-1 rounded-[3px] font-display text-[15px] font-bold italic uppercase tracking-[0.05em] text-ink ${
                  valid ? 'bg-brand cursor-pointer' : 'bg-[#3a1614] opacity-60 cursor-not-allowed'
                }`}
              >
                {join.isPending ? 'Joining…' : 'Join League'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
