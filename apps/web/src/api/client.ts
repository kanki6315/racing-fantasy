import createClient from 'openapi-fetch'
import type { paths } from './schema'

// Dev: "/api" is proxied to the .NET API (see vite.config.ts). Prod: set VITE_API_BASE_URL.
// credentials:'include' carries the endurance.session cookie once auth lands (F1).
export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  credentials: 'include',
})
