import { Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from './app/RootLayout'
import { Landing } from './routes/Landing'
import { ComingSoon } from './routes/ComingSoon'
import { RequireAuth } from './auth/RequireAuth'
import { RequireAdmin } from './auth/RequireAdmin'
import {
  AdminLayout,
  AdminOverview,
  Catalog,
  Dashboard,
  Entries,
  Events,
  LeagueStandings,
  Pick,
  Prices,
  Registrations,
  Results,
  RouteFallback,
  Rulesets,
  Scoring,
  Standings,
  Stats,
  TeamPicks,
  UsersData,
} from './app/lazyRoutes'

/** Every lazy route renders behind the same fallback; see `app/lazyRoutes.tsx` for why they're split. */
const page = (node: ReactNode) => <Suspense fallback={<RouteFallback />}>{node}</Suspense>

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'dashboard', element: page(<RequireAuth><Dashboard /></RequireAuth>) },
      { path: 'pick/:roundId', element: page(<RequireAuth><Pick /></RequireAuth>) },
      { path: 'leagues/:id', element: page(<RequireAuth><LeagueStandings /></RequireAuth>) },
      { path: 'standings', element: page(<Standings />) },
      {
        path: 'standings/team/:registrationId/round/:roundId',
        element: page(<RequireAuth><TeamPicks /></RequireAuth>),
      },
      { path: 'stats', element: page(<Stats />) },
      { path: '*', element: <ComingSoon title="Not Found" subtitle="That page doesn't exist" /> },
    ],
  },
  {
    path: '/admin',
    element: page(
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>,
    ),
    children: [
      { index: true, element: page(<AdminOverview />) },
      { path: 'catalog', element: page(<Catalog />) },
      { path: 'events', element: page(<Events />) },
      { path: 'entries', element: page(<Entries />) },
      { path: 'prices', element: page(<Prices />) },
      { path: 'results', element: page(<Results />) },
      { path: 'rulesets', element: page(<Rulesets />) },
      { path: 'scoring', element: page(<Scoring />) },
      { path: 'registrations', element: page(<Registrations />) },
      { path: 'users', element: page(<UsersData />) },
    ],
  },
])
