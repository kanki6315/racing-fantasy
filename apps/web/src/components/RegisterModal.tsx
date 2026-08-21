import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router-dom'
import { useRegister } from '../api/queries'
import { useAuth } from '../auth/AuthContext'
import { EmailPreferenceControls, prefsFromList, type EmailPrefs, type ReminderKind } from './EmailPreferences'

const MIN = 3
const MAX = 32 // design caps at 32 (backend allows ≤40); '@' is rejected (it's the public identifier)

/** Team-name registration modal. POST /registrations → refetch /auth/me → go to dashboard,
 * unless `onRegistered` is given — the pick page registers in place and stays on the round. */
export function RegisterModal({
  seasonId,
  open,
  onOpenChange,
  onRegistered,
  confirmLabel = 'Confirm & Go to Dashboard',
}: {
  seasonId: number
  open: boolean
  onOpenChange: (v: boolean) => void
  onRegistered?: () => void
  confirmLabel?: string
}) {
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const { user } = useAuth()
  // Seed from the user's current preferences so registering for a new series doesn't reset them
  // (the POST upserts what's submitted). Re-sync when the modal opens — on Landing it stays mounted.
  const [prefs, setPrefs] = useState<EmailPrefs>(() => prefsFromList(user?.emailPreferences))
  useEffect(() => {
    if (open) setPrefs(prefsFromList(user?.emailPreferences))
    // Only on the open transition, so a background /auth/me refetch can't clobber an in-progress edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const register = useRegister()
  const navigate = useNavigate()
  const setPref = (kind: ReminderKind, enabled: boolean) => setPrefs((p) => ({ ...p, [kind]: enabled }))

  const trimmed = name.trim()
  const hasAt = trimmed.includes('@')
  const valid = trimmed.length >= MIN && trimmed.length <= MAX && !hasAt
  const showError = touched && !valid && trimmed.length > 0
  const errorMsg = hasAt ? "Team name can't contain '@'." : 'Team name needs at least 3 characters.'
  const count = name.length
  // `muted` is the floor for de-emphasised text — muted-2 lands around 3.2:1 on the modal's well.
  const countColor = count > MAX ? 'text-danger' : count >= 28 ? 'text-warn' : 'text-muted'

  const submit = async () => {
    if (!valid || register.isPending) {
      setTouched(true)
      return
    }
    try {
      await register.mutateAsync({
        seasonId,
        teamName: trimmed,
        emailPreferences: [
          { kind: 'PicksOpen', enabled: prefs.PicksOpen },
          { kind: 'PicksClosing', enabled: prefs.PicksClosing },
        ],
      })
      onOpenChange(false)
      if (onRegistered) onRegistered()
      else navigate('/dashboard')
    } catch {
      /* surfaced via register.isError below */
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !register.isPending && onOpenChange(v)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(4,5,6,0.78)] backdrop-blur-[3px]" />
        <Dialog.Content
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[6px] border border-line-2 bg-surface-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] focus:outline-none"
        >
          <div className="h-1 bg-gradient-to-r from-brand to-brand-3" />
          <div className="px-7 pt-[26px]">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[11px] tracking-[0.14em] text-brand-3 mb-[9px]">// JOIN_2026</div>
                <Dialog.Title className="font-display text-[28px] font-extrabold uppercase leading-[0.96] text-ink">
                  Name your team
                </Dialog.Title>
                <Dialog.Description className="mt-2 font-sans text-[13px] text-muted">
                  This is how you'll show up on leaderboards and in every league. In public leagues, only
                  your team name is shared — never your real name.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="ml-3.5 flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[3px] border border-line-2 cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8f98" strokeWidth="2.2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </Dialog.Close>
            </div>

            <div className="mt-[22px]">
              <label className="mb-[9px] flex items-center justify-between">
                <span className="font-display text-[12px] font-semibold tracking-[0.1em] uppercase text-ink-2">Team Name</span>
                <span className={`font-mono text-[11px] ${countColor}`}>{count}/{MAX}</span>
              </label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setTouched(true)
                }}
                maxLength={MAX}
                autoFocus
                placeholder="e.g. No Lift Crew"
                className={`h-[50px] w-full rounded-[4px] border bg-[#070809] px-[15px] font-display text-[20px] font-bold tracking-[0.02em] text-ink outline-none placeholder:text-muted ${
                  showError ? 'border-danger' : valid ? 'border-success/60' : 'border-line-2'
                }`}
              />
              <div className="mt-[9px] flex min-h-[18px] items-center gap-[7px]">
                {showError && <span className="font-sans text-[12px] text-danger">{errorMsg}</span>}
                {valid && !register.isError && (
                  <span className="font-sans text-[12px] text-muted">Looks good — set your team name.</span>
                )}
                {register.isError && (
                  <span className="font-sans text-[12px] text-danger">
                    Couldn't create your team — try a different name.
                  </span>
                )}
              </div>
            </div>

            {/* live leaderboard preview */}
            <div className="mt-[14px] rounded-[4px] border border-line bg-[#070809] px-[15px] py-[13px]">
              <div className="mb-[9px] font-display text-[10px] tracking-[0.14em] uppercase text-muted">Leaderboard preview</div>
              <div className="grid grid-cols-[34px_1fr_70px] items-center">
                <span className="font-mono text-[14px] font-bold text-ink">—</span>
                <span className={`font-sans text-[14px] font-bold ${trimmed ? 'text-ink' : 'text-muted'}`}>
                  {trimmed || 'Your Team'}
                </span>
                <span className="text-right">
                  <span className="font-mono text-[14px] font-bold text-ink">0</span>
                  <span className="ml-1 font-display text-[10px] tracking-[0.06em] text-muted">PTS</span>
                </span>
              </div>
            </div>

            {/* Picks-reminder email preferences (ADR-0009 amendment) — always shown, off by default. */}
            <div className="mt-[16px]">
              <div className="mb-[8px] font-display text-[11px] tracking-[0.12em] uppercase text-muted">Race emails</div>
              <EmailPreferenceControls prefs={prefs} onChange={setPref} pending={register.isPending} />
              <p className="mt-[8px] font-sans text-[11px] leading-[15px] text-muted">
                Optional — one email each, unsubscribe anytime. Change these later from your dashboard.
              </p>
            </div>
          </div>

          <div className="mt-[22px] flex items-center gap-[11px] border-t border-line bg-[#0b0c0f] px-7 pb-6 pt-[22px]">
            <Dialog.Close className="flex h-[46px] items-center justify-center rounded-[3px] border border-line-2 px-5 cursor-pointer">
              <span className="font-display text-[14px] font-semibold tracking-[0.05em] uppercase text-ink-2">Cancel</span>
            </Dialog.Close>
            <button
              type="button"
              onClick={submit}
              disabled={!valid || register.isPending}
              className={`flex h-[46px] flex-1 items-center justify-center gap-[9px] rounded-[3px] ${
                valid ? 'bg-brand cursor-pointer' : 'bg-[#3a1614] opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="font-display text-[16px] font-bold italic tracking-[0.05em] uppercase text-ink">
                {register.isPending ? 'Creating team…' : confirmLabel}
              </span>
              {!register.isPending && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
