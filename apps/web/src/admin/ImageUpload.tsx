import { useRef, useState } from 'react'
import { GhostButton } from './ui'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'

const MAX_BYTES = 5 * 1024 * 1024
const WEBP_QUALITY = 0.85
// Decoupled cache TTLs for rarely-changing images we replace by manual CloudFront invalidation:
//  - max-age=300  → BROWSERS re-check every 5 min, so after an invalidation everyone converges fast
//                   (a CloudFront invalidation clears the edge only, NOT already-cached browsers).
//  - s-maxage=1d  → CloudFront holds it a day (efficient edge); invalidate the path on the rare change.
// Honored only if the distribution's cache policy respects origin Cache-Control (CachingOptimized does).
const CACHE_CONTROL = 'max-age=300, s-maxage=86400'

/** Re-encode any image file to WebP in-browser (no resize — EXIF orientation respected). */
async function toWebp(file: File, quality = WEBP_QUALITY): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality))
  if (!blob) throw new Error('WebP conversion failed')
  return blob
}

/**
 * Admin image uploader. The browser converts the chosen image to WebP, then: POST `uploadPath` (an
 * /admin/images/... route) for a presigned S3 PUT URL, and PUT the WebP straight to S3 (bytes never
 * touch our API). Convention-keyed, so on success we just cache-bust the same display URL.
 */
export function ImageUpload({
  uploadPath,
  previewUrl,
  label,
  shape = 'square',
  onUploaded,
}: {
  uploadPath: string
  previewUrl: string | null
  label: string
  shape?: 'square' | 'wide'
  onUploaded?: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [bust, setBust] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  const src = previewUrl ? `${previewUrl}${bust ? `?t=${bust}` : ''}` : null
  const box = shape === 'wide' ? 'aspect-[16/9] w-32' : 'h-20 w-20'

  const upload = async (file: File) => {
    setErr(null)
    setBusy(true)
    try {
      // 1. convert to WebP in the browser (keeps S3/CloudFront payloads small)
      const webp = await toWebp(file)
      if (webp.size > MAX_BYTES) throw new Error('Image too large after conversion (max 5 MB)')
      // 2. ask our API for a short-lived presigned PUT URL (cookie-authed, admin-only)
      const res = await fetch(`${apiBase}${uploadPath}`, { method: 'POST', credentials: 'include' })
      if (!res.ok) {
        throw new Error(res.status === 503 ? 'Image storage not configured' : `Presign failed (${res.status})`)
      }
      const { uploadUrl } = (await res.json()) as { uploadUrl: string }
      // 3. upload the WebP straight to S3 — NO cookies, just the signed URL + content type.
      // Cache-Control is stored as object metadata so CloudFront revalidates within the window.
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: webp,
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': CACHE_CONTROL },
      })
      if (!put.ok) throw new Error(`S3 upload failed (${put.status}) — check bucket CORS`)
      setBroken(false)
      setBust(Date.now())
      onUploaded?.()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div>
      <div className="mb-[6px] font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">{label}</div>
      <div className="flex items-center gap-3">
        <div className={`${box} shrink-0 overflow-hidden rounded-[5px] border border-line-2 bg-surface-3`}>
          {src && !broken ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[9px] uppercase text-muted-2">
              none
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <GhostButton onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : 'Upload Image'}
          </GhostButton>
          {err && <span className="font-mono text-[10px] text-danger">{err}</span>}
        </div>
      </div>
    </div>
  )
}
