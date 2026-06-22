import { createContext, useContext, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { components } from '../api/schema'

export type Me = components['schemas']['AuthMeResponse']

const meKey = ['auth', 'me'] as const
const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'

/**
 * Cookie-session auth (ADR-0004). There is no client-side token: the browser holds the HttpOnly
 * `endurance.session` cookie and sends it automatically (client.ts sets credentials:'include'). The
 * "auth state" is just the cached result of GET /auth/me — 200 ⇒ signed in, 401 ⇒ anonymous.
 */
type AuthValue = {
  user: Me | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  loginWithGoogle: () => void
  logout: () => Promise<void>
  devLogin: (subject: string, name?: string, email?: string) => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<Me | null> => {
      const { data, error, response } = await api.GET('/auth/me')
      if (response.status === 401) return null // anonymous, not an error
      if (!response.ok || error) throw error ?? new Error(`auth/me failed (${response.status})`)
      return data ?? null
    },
    staleTime: 60_000,
  })

  const user = data ?? null

  // Full-page redirect into the server's Google challenge; it returns us here after setting the cookie.
  const loginWithGoogle = () => {
    window.location.href = `${apiBase}/auth/login?returnUrl=${encodeURIComponent(window.location.href)}`
  }

  const logout = async () => {
    await api.POST('/auth/logout')
    qc.setQueryData(meKey, null)
    await qc.invalidateQueries({ queryKey: meKey })
  }

  // Development only (the endpoint 404s outside Development).
  const devLogin = async (subject: string, name?: string, email?: string) => {
    await api.POST('/auth/dev-login', { params: { query: { subject, name, email } } })
    await qc.invalidateQueries({ queryKey: meKey })
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, isAdmin: !!user?.isAdmin, loginWithGoogle, logout, devLogin }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
