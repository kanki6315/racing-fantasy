import { Link, Outlet } from 'react-router-dom'
import { GlobalNav } from '../components/GlobalNav'
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal'

/** App shell: global nav, the routed page, then a small footer pinned to the bottom. */
export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <GlobalNav />
      <div className="flex-1">
        <Outlet />
      </div>
      <footer className="border-t border-line px-4 py-4 text-center font-sans text-[12px] text-muted sm:px-[26px]">
        Built by <Link to="https://arjunakankipati.com" className="text-muted hover:text-ink-2 transition-colors">Arjuna Kankipati</Link> with <Link to="/ai-policy" className="text-muted hover:text-ink-2 transition-colors">help from AI</Link>
        <span className="mx-2 text-muted-2">|</span>
        <PrivacyPolicyModal triggerClassName="text-muted hover:text-ink-2 transition-colors cursor-pointer" />
      </footer>
    </div>
  )
}
