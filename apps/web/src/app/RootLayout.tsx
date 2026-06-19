import { Outlet } from 'react-router-dom'
import { GlobalNav } from '../components/GlobalNav'
import { ChampionshipStrip } from '../components/ChampionshipStrip'

/** App shell: global nav + live championships strip, then the routed page. */
export function RootLayout() {
  return (
    <div className="min-h-screen bg-bg">
      <GlobalNav />
      <ChampionshipStrip />
      <Outlet />
    </div>
  )
}
