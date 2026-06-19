/**
 * Image URL conventions (keys must match the backend ImageEndpoints). The public read base URL is a
 * frontend build-time env var, `VITE_IMAGE_BASE_URL` (the bucket URL or CDN domain) — the backend no
 * longer exposes it. Returns null when unset so callers fall back to a placeholder.
 */
export const imageBaseUrl: string | null =
  (import.meta.env.VITE_IMAGE_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? null

export function liveryUrl(roundId: number, entryId: number): string | null {
  return imageBaseUrl ? `${imageBaseUrl}/liveries/${roundId}/${entryId}.webp` : null
}

export function headshotUrl(driverId: number): string | null {
  return imageBaseUrl ? `${imageBaseUrl}/drivers/${driverId}.webp` : null
}
