import { useState } from 'react'
import { headshotUrl } from '../lib/images'

type Driver = { id: number; fullName: string }

const lastName = (full: string) => full.trim().split(/\s+/).slice(-1)[0] ?? full
const initials = (full: string) => {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/**
 * Circular driver headshot, with initials underneath rather than instead.
 *
 * The initials used to be an alternative branch taken only when the URL was null or the object had
 * already failed, so a headshot still in flight rendered an empty disc — and a lineup of four
 * rendered four. They are the slot's resting state now, and the photo covers them once it decodes.
 *
 * The name is carried by the wrapper (`role="img"` + `aria-label`) rather than by the `<img>`'s alt,
 * so it is announced once and identically whether or not the photo ever arrives; the initials and the
 * photo are both decorative in that arrangement.
 */
function DriverAvatar({ driver, px }: { driver: Driver; px: number }) {
  const [broken, setBroken] = useState(false)
  const url = headshotUrl(driver.id)
  const style = { width: px, height: px }
  return (
    <span
      role="img"
      aria-label={driver.fullName}
      title={driver.fullName}
      style={{ ...style, fontSize: px * 0.4 }}
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 font-display font-bold text-muted ring-1 ring-line-2"
    >
      <span aria-hidden>{initials(driver.fullName)}</span>
      {url && !broken && (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full rounded-full object-cover"
        />
      )}
    </span>
  )
}

/**
 * A car's driver lineup — co-drivers who share the entry. `full` shows a chip (avatar + surname) per
 * driver; `compact` shows an overlapping avatar stack + a surname list, for tight rows. Renders
 * nothing when there is no lineup (e.g. driver-based series, where picks are drivers themselves).
 */
export function DriverLineup({
  drivers,
  variant = 'full',
  className = '',
}: {
  drivers: Driver[] | null | undefined
  variant?: 'full' | 'compact'
  className?: string
}) {
  if (!drivers?.length) return null

  if (variant === 'compact') {
    return (
      <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
        <span className="flex shrink-0 -space-x-1.5">
          {drivers.slice(0, 4).map((d) => (
            <DriverAvatar key={d.id} driver={d} px={16} />
          ))}
        </span>
        <span className="truncate font-sans text-[11px] text-muted">
          {drivers.map((d) => lastName(d.fullName)).join(' · ')}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      {drivers.map((d) => (
        <span key={d.id} className="flex items-center gap-1.5">
          <DriverAvatar driver={d} px={20} />
          <span className="font-display text-[12px] font-semibold uppercase tracking-[0.02em] text-ink-2">
            {lastName(d.fullName)}
          </span>
        </span>
      ))}
    </div>
  )
}
