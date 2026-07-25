import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Gates the admin console to admins (isAdmin from /auth/me). Anonymous users bounce to the landing
 * page with a sign-in prompt; signed-in non-admins are sent to their dashboard. The server still
 * enforces the "Admin" policy on every endpoint — this only hides UI that would 403 anyway.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 font-mono text-[12px] tracking-[0.12em] uppercase text-muted">
        Checking session…
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname, signin: true }} />
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
