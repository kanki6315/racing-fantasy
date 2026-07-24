/**
 * Picks-reminder email preferences (ADR-0009 amendment): a client-side "all race emails" master
 * (sub/unsub both — no DB state of its own) above the two DB-backed per-kind toggles. Controlled;
 * used in the registration modal (local state) and the dashboard (persists each change).
 */
export type ReminderKind = 'PicksOpen' | 'PicksClosing'
export type EmailPrefs = { PicksOpen: boolean; PicksClosing: boolean }

const KINDS: { kind: ReminderKind; label: string; hint: string }[] = [
  { kind: 'PicksOpen', label: 'When picks open', hint: 'the moment the board opens' },
  { kind: 'PicksClosing', label: 'Before picks close', hint: '~24h before qualifying' },
]

/** Resolve the /auth/me emailPreferences list (kinds may be missing) into a full state. */
export function prefsFromList(list: { kind: string; enabled: boolean }[] | undefined): EmailPrefs {
  const on = (k: ReminderKind) => list?.find((p) => p.kind === k)?.enabled ?? false
  return { PicksOpen: on('PicksOpen'), PicksClosing: on('PicksClosing') }
}

export function EmailPreferenceControls({
  prefs,
  onChange,
  pending,
}: {
  prefs: EmailPrefs
  onChange: (kind: ReminderKind, enabled: boolean) => void
  pending?: boolean
}) {
  const bothOn = prefs.PicksOpen && prefs.PicksClosing
  const setBoth = () => {
    const next = !bothOn
    onChange('PicksOpen', next)
    onChange('PicksClosing', next)
  }

  return (
    <div className="flex flex-col gap-[6px]">
      {/* Master (client-side only) */}
      <button
        type="button"
        onClick={setBoth}
        disabled={pending}
        aria-pressed={bothOn}
        className={`flex w-full items-center justify-between gap-2 rounded-[3px] border px-[13px] py-[10px] text-left cursor-pointer ${
          bothOn ? 'border-success/50 bg-success/[0.06]' : 'border-dotted border-line-3 bg-surface-2'
        }`}
      >
        <span className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2">
          <span className={`h-[15px] w-[4px] flex-none [transform:skewX(-14deg)] ${bothOn ? 'bg-brand' : 'bg-line-3'}`} />
          All race emails
        </span>
        <span className="flex-none font-display text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
          {bothOn ? 'Unsub all' : 'Sub all'}
        </span>
      </button>

      {/* Individual, DB-backed toggles */}
      <div className="flex flex-col gap-[6px] pl-[10px]">
        {KINDS.map(({ kind, label, hint }) => {
          const on = prefs[kind]
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onChange(kind, !on)}
              disabled={pending}
              aria-pressed={on}
              className={`flex w-full items-center justify-between gap-2 rounded-[3px] border px-[13px] py-[8px] text-left cursor-pointer ${
                on ? 'border-success/50 bg-success/[0.06]' : 'border-dotted border-line-3 bg-surface-2'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-[13px] w-[3px] flex-none [transform:skewX(-14deg)] ${on ? 'bg-brand' : 'bg-line-3'}`} />
                <span className="min-w-0">
                  <span className="block font-display text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-2">{label}</span>
                  <span className="block font-sans text-[10px] leading-[13px] text-muted">{hint}</span>
                </span>
              </span>
              {on ? (
                <svg className="h-[14px] w-[14px] flex-none text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="On">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="flex-none font-display text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Off</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
