import type { ReactNode } from 'react'

/** A single pill toggle — the shared building block for the standings filters. */
export function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-[3px] px-[14px] font-display text-[13px] font-semibold uppercase tracking-[0.04em] transition-colors cursor-pointer ${
        active ? 'bg-brand text-ink' : 'border border-line-2 text-muted hover:text-ink-2'
      }`}
    >
      {children}
    </button>
  )
}

/** A labelled row of pills — used for the Championship and Year levels of the leaderboard filter. */
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      <span className="mr-1 font-display text-[10px] tracking-[0.14em] uppercase text-muted-2">{label}</span>
      {children}
    </div>
  )
}

/**
 * The Total | per-round sub-filter, shared by season standings and league standings.
 * `value` is `'season'` (the season-wide pool) or a round id.
 */
export function RoundFilter({
  rounds,
  value,
  onChange,
}: {
  rounds: { id: number; name: string }[]
  value: 'season' | number
  onChange: (v: 'season' | number) => void
}) {
  return (
    <div className="flex flex-wrap gap-[6px] border-b border-line pb-[14px]">
      <FilterTab active={value === 'season'} onClick={() => onChange('season')}>
        Total
      </FilterTab>
      {rounds.map((r) => (
        <FilterTab key={r.id} active={value === r.id} onClick={() => onChange(r.id)}>
          {r.name}
        </FilterTab>
      ))}
    </div>
  )
}
