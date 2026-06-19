import type { ReactNode } from 'react'

/** Visually marks a value sourced from demoStats (mocked, not yet API-backed). */
export function Demo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      title="Demo data — not yet backed by the API"
      className={`underline decoration-dotted decoration-muted-2/60 underline-offset-2 ${className}`}
    >
      {children}
    </span>
  )
}
