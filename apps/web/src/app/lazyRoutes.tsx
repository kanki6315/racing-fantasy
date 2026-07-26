import { lazy } from 'react'

/*
 * Lazily-loaded route components, kept out of `router.tsx` so that file exports only the router.
 * (`react-refresh/only-export-components` — a module that mixes component declarations with a
 * non-component export breaks Fast Refresh.)
 *
 * The app previously built as one 641 kB chunk that every visitor parsed before first paint,
 * including all ten admin screens — roughly half the route source, which no player ever opens.
 * Landing and ComingSoon stay eager in `router.tsx`: Landing is the index route, so deferring it
 * would only add a round trip to first paint, and ComingSoon is the 404 that has to render when
 * nothing else can.
 */

export const Dashboard = lazy(() => import('../routes/Dashboard').then((m) => ({ default: m.Dashboard })))
export const Pick = lazy(() => import('../routes/Pick').then((m) => ({ default: m.Pick })))
export const Standings = lazy(() => import('../routes/Standings').then((m) => ({ default: m.Standings })))
export const Stats = lazy(() => import('../routes/Stats').then((m) => ({ default: m.Stats })))
export const TeamPicks = lazy(() => import('../routes/TeamPicks').then((m) => ({ default: m.TeamPicks })))
export const LeagueStandings = lazy(() =>
  import('../routes/LeagueStandings').then((m) => ({ default: m.LeagueStandings })),
)

export const AdminLayout = lazy(() => import('../admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
export const AdminOverview = lazy(() => import('../routes/admin/Overview').then((m) => ({ default: m.AdminOverview })))
export const Catalog = lazy(() => import('../routes/admin/Catalog').then((m) => ({ default: m.Catalog })))
export const Events = lazy(() => import('../routes/admin/Events').then((m) => ({ default: m.Events })))
export const Entries = lazy(() => import('../routes/admin/Entries').then((m) => ({ default: m.Entries })))
export const Prices = lazy(() => import('../routes/admin/Prices').then((m) => ({ default: m.Prices })))
export const Registrations = lazy(() =>
  import('../routes/admin/Registrations').then((m) => ({ default: m.Registrations })),
)
export const UsersData = lazy(() => import('../routes/admin/UsersData').then((m) => ({ default: m.UsersData })))
export const Results = lazy(() => import('../routes/admin/Results').then((m) => ({ default: m.Results })))
export const Scoring = lazy(() => import('../routes/admin/Scoring').then((m) => ({ default: m.Scoring })))
export const Rulesets = lazy(() => import('../routes/admin/Rulesets').then((m) => ({ default: m.Rulesets })))

/**
 * Chunk-fetch fallback. Borrows the loading voice the routes already use (mono, tracked, muted)
 * rather than a spinner, and reserves height so swapping it for the real route doesn't shift layout.
 */
export function RouteFallback() {
  return (
    <div className="py-32 text-center font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
      Loading…
    </div>
  )
}
