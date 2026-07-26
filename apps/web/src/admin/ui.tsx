import type { ReactNode, SelectHTMLAttributes } from 'react'

/** Shared admin form/table primitives, styled to the broadcast design tokens. */

export function Panel({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rounded-[6px] border border-line bg-surface">
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          {title && (
            <h2 className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted">{title}</h2>
          )}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-[6px] block font-mono text-[9px] tracking-[0.12em] uppercase text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block font-sans text-[11px] text-muted">{hint}</span>}
    </label>
  )
}

const inputClass =
  'h-9 w-full rounded-[4px] border border-line-2 bg-surface-3 px-3 font-sans text-[13px] text-ink placeholder:text-muted focus:border-brand focus:outline-none'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} cursor-pointer ${props.className ?? ''}`}>
      {children}
    </select>
  )
}

/**
 * The primary action's look, as a string, because the console needs it on both a `<button>` and a
 * `<Link>` — the Overview's one call to action is a navigation, not a submit. Two hand-copied class
 * lists is how the same action ends up two different sizes on two screens.
 */
export const PRIMARY_ACTION_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-[4px] bg-brand px-4 font-display text-[12px] font-semibold uppercase tracking-[0.05em] text-ink transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-40'

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={`${PRIMARY_ACTION_CLASS} ${props.className ?? ''}`}>
      {children}
    </button>
  )
}

export function GhostButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center gap-2 rounded-[4px] border border-line-2 px-4 font-display text-[12px] font-semibold uppercase tracking-[0.05em] text-muted hover:border-line-3 hover:text-ink-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`h-8 rounded-[4px] px-3 font-display text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors ${
            active === t.id
              ? 'bg-ink text-bg'
              : 'border border-line-2 text-muted hover:border-line-3 hover:text-ink-2'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** A selectable list row; red left bar + raised surface when selected. */
export function ListRow({
  selected,
  onClick,
  children,
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 border-b border-line px-3 py-[10px] text-left transition-colors last:border-b-0 ${
        selected
          ? 'bg-surface-2 before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-brand'
          : 'hover:bg-surface-2/50'
      }`}
    >
      {children}
    </button>
  )
}

export function ClassSwatch({ hex }: { hex: string }) {
  return <span className="inline-block h-[10px] w-[10px] shrink-0 rounded-[2px]" style={{ backgroundColor: hex }} />
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[6px] border border-dashed border-line-2 bg-surface/40 px-6 py-10 text-center font-mono text-[11px] tracking-[0.08em] uppercase text-muted">
      {children}
    </div>
  )
}

/**
 * A failed fetch and an empty result render as the same screen unless something says otherwise.
 * This says which it is, and gives the operator the one thing an error state owes them: a way to
 * try again. Shared, because the second surface that needed it — the cross-championship band —
 * initially skipped it and returned `null`, which is exactly the silence this exists to prevent.
 */
export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-[6px] border border-danger/40 bg-danger/[0.07] px-5 py-4"
    >
      <div className="min-w-0">
        <div className="font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-ink">
          Data didn't load
        </div>
        <div className="mt-[2px] font-sans text-[12px] text-ink-2">{message}</div>
      </div>
      <GhostButton onClick={onRetry} className="shrink-0">
        Retry
      </GhostButton>
    </div>
  )
}
