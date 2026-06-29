import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from './app/RootLayout'
import { Landing } from './routes/Landing'
import { ComingSoon } from './routes/ComingSoon'
import { Dashboard } from './routes/Dashboard'
import { Pick } from './routes/Pick'
import { Standings } from './routes/Standings'
import { Stats } from './routes/Stats'
import { TeamPicks } from './routes/TeamPicks'
import { LeagueStandings } from './routes/LeagueStandings'
import { RequireAuth } from './auth/RequireAuth'
import { RequireAdmin } from './auth/RequireAdmin'
import { AdminLayout } from './admin/AdminLayout'
import { AdminOverview } from './routes/admin/Overview'
import { Catalog } from './routes/admin/Catalog'
import { Events } from './routes/admin/Events'
import { Entries } from './routes/admin/Entries'
import { Prices } from './routes/admin/Prices'
import { Registrations } from './routes/admin/Registrations'
import { UsersData } from './routes/admin/UsersData'
import { Results } from './routes/admin/Results'
import { Scoring } from './routes/admin/Scoring'
import { Rulesets } from './routes/admin/Rulesets'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'dashboard', element: <RequireAuth><Dashboard /></RequireAuth> },
      { path: 'pick/:roundId', element: <RequireAuth><Pick /></RequireAuth> },
      { path: 'leagues/:id', element: <RequireAuth><LeagueStandings /></RequireAuth> },
      { path: 'standings', element: <Standings /> },
      {
        path: 'standings/team/:registrationId/round/:roundId',
        element: <RequireAuth><TeamPicks /></RequireAuth>,
      },
      { path: 'stats', element: <Stats /> },
      { path: '*', element: <ComingSoon title="Not Found" subtitle="That page doesn't exist" /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <AdminOverview /> },
      { path: 'catalog', element: <Catalog /> },
      { path: 'events', element: <Events /> },
      { path: 'entries', element: <Entries /> },
      { path: 'prices', element: <Prices /> },
      { path: 'results', element: <Results /> },
      { path: 'rulesets', element: <Rulesets /> },
      { path: 'scoring', element: <Scoring /> },
      { path: 'registrations', element: <Registrations /> },
      { path: 'users', element: <UsersData /> },
    ],
  },
])
