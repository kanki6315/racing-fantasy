import type { ReactNode } from 'react'

/** Admin page header: the skewed red accent bar + condensed-italic title + muted subtitle, with optional actions. */
export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-7 w-[5px] shrink-0 bg-brand [transform:skewX(-12deg)]" />
        <div>
          <h1 className="font-display text-[27px] font-bold italic uppercase leading-none tracking-[0.01em] text-ink">
            {title}
          </h1>
          {subtitle && <div className="mt-2 font-sans text-[13px] text-muted">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
