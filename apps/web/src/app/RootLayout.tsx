import { Link, Outlet, useMatch } from 'react-router-dom'
import { GlobalNav } from '../components/GlobalNav'
import { AiPolicyModal } from '../components/AiPolicyModal'
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal'

/** App shell: global nav, the routed page, then a small footer pinned to the bottom. */
export function RootLayout() {
  // The roster builder is a workspace, not a document: at lg+ it fills the viewport exactly once so
  // its two panels can scroll independently and the cap, the class pills and Save stay on screen
  // while the player picks. That only works if the shell stops growing, so the page here is
  // viewport-height and the footer (page furniture, not workspace chrome) steps out. Below lg the
  // shell is unchanged — the page scrolls normally and the route pins its own chrome with `sticky`.
  const workspace = useMatch('/pick/:roundId') != null

  return (
    <div className={`flex min-h-screen flex-col bg-bg ${workspace ? 'lg:h-[100svh] lg:min-h-0 lg:overflow-hidden' : ''}`}>
      <GlobalNav />
      {/* `main`, not a div: without it the page had only NAV/NAV/FOOTER landmarks, so skip-to-content
          and landmark navigation had nowhere to land on any route. */}
      <main className={`flex-1 ${workspace ? 'lg:min-h-0' : ''}`}>
        <Outlet />
      </main>
      <footer
        className={`border-t border-line px-4 py-4 text-center font-sans text-[12px] text-muted sm:px-[26px] ${
          workspace ? 'lg:hidden' : ''
        }`}
      >
        Built by <Link to="https://arjunakankipati.com" className="text-muted hover:text-ink-2 transition-colors">Arjuna Kankipati</Link> with <AiPolicyModal triggerClassName="text-muted hover:text-ink-2 transition-colors cursor-pointer" />
        <span className="mx-2 text-muted">|</span>
        <PrivacyPolicyModal triggerClassName="text-muted hover:text-ink-2 transition-colors cursor-pointer" />
      </footer>
    </div>
  )
}
