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
 * resolve to null when VITE_IMAGE_BASE_URL is unset.
 *
 * The class-tinted placeholder is the slot's *background*, not an alternative to the image. It used
 * to be an either/or — image when a URL existed, placeholder when it didn't or when loading failed —
 * which left the one state nobody had designed for: a URL that has not arrived yet rendered a bare
 * `bg-surface-3` box. The picks board is where class colour does the wayfinding, and on a slow
 * connection every slot on it went blank; `loading="lazy"` then repeated that on each scroll. Now the
 * tint and icon are always painted and the photo simply covers them once it decodes, so the slot
 * carries class identity from first paint and degrades to it again if the object 404s.
 */
export function EntityThumb({ entityType, entityId, roundId, shape = 'wide', tintHex = '#3a3f47', className = '' }: Props) {
  const [broken, setBroken] = useState(false)
  const url = entityType === 'Car' ? liveryUrl(roundId, entityId) : headshotUrl(entityId)
  const ratio = shape === 'wide' ? 'aspect-[16/9]' : 'aspect-square'

  return (
    <div
      className={`${ratio} ${className} relative flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-surface-3`}
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
      {url && !broken && (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  )
}
