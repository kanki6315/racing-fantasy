import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Gates a route to signed-in users. Anonymous → bounce to the landing page (with a sign-in prompt). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
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
  return <>{children}</>
}
