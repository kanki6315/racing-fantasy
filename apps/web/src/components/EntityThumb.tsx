import { useState } from 'react'
import { headshotUrl, liveryUrl } from '../lib/images'

type Props = {
  entityType: 'Car' | 'Driver'
  entityId: number
  roundId: number
  /** 'wide' (16:9 livery) or 'square' (headshot). */
  shape?: 'wide' | 'square'
  /** Class color used to tint the fallback placeholder. */
  tintHex?: string
  /** Width utility (e.g. 'w-24') — the component owns the aspect ratio, rounding and overflow. */
  className?: string
}

/**
 * Car livery or driver headshot thumbnail. URLs follow the S3 convention (src/lib/images.ts) and
 * resolve to null when VITE_IMAGE_BASE_URL is unset; a class-tinted placeholder also covers a missing
 * or broken object, so every slot renders something.
 */
export function EntityThumb({ entityType, entityId, roundId, shape = 'wide', tintHex = '#3a3f47', className = '' }: Props) {
  const [broken, setBroken] = useState(false)
  const url = entityType === 'Car' ? liveryUrl(roundId, entityId) : headshotUrl(entityId)
  const ratio = shape === 'wide' ? 'aspect-[16/9]' : 'aspect-square'
  const base = `${ratio} ${className} shrink-0 overflow-hidden rounded-[4px] bg-surface-3`

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className={`${base} object-cover`}
      />
    )
  }

  return (
    <div
      className={`${base} flex items-center justify-center`}
      style={{ background: `linear-gradient(135deg, ${tintHex}26, transparent)` }}
      aria-hidden
    >
      <svg width="42%" height="42%" viewBox="0 0 24 24" fill="none" stroke={tintHex} strokeWidth="1.5" opacity="0.65">
        {entityType === 'Car' ? (
          <>
            <path d="M3 13l2.2-5h13.6L21 13M5 13h14v4H5z" />
            <circle cx="7.5" cy="17" r="1.6" />
            <circle cx="16.5" cy="17" r="1.6" />
          </>
        ) : (
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </>
        )}
      </svg>
    </div>
  )
}
