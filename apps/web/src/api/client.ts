import createClient from 'openapi-fetch'
import type { paths } from './schema'

// Dev: "/api" is proxied to the .NET API (see vite.config.ts). Prod: set VITE_API_BASE_URL.
// credentials:'include' carries the endurance.session cookie once auth lands (F1).
export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  credentials: 'include',
})

/** A non-2xx response, carrying the status so a caller can branch on 404 / 409 / 429. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`Request failed with ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Throw on any non-2xx, then hand back the body.
 *
 * The usual `if (error) throw error` is not enough: openapi-fetch can only populate `error` from a
 * response body, so a failure with an *empty* body — a 502 from a dead proxy, a gateway timeout —
 * arrives as `error: ""`, which is falsy. The throw is skipped, `data` is undefined, and a hook
 * that defaults it to `[]` reports "there is nothing here" for "we could not ask". That is
 * indistinguishable from real emptiness on screen, which is the worst failure mode an operations
 * console has. The response's own `ok` flag is the only reliable signal.
 *
 * Callers that legitimately read a status (the roster 409, the stats 409) still branch on
 * `response.status` themselves and must not use this.
 */
export function unwrap<T>(res: { data?: T; error?: unknown; response: Response }): T | undefined {
  if (!res.response.ok) throw new ApiError(res.response.status, res.error)
  return res.data
}
