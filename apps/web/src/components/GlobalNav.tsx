import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import { useAuth, type Me } from '../auth/AuthContext'
import { useActiveSeason } from '../api/queries'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/standings', label: 'Standings' },
  { to: '/stats', label: 'Stats' },
  { to: '/calendar', label: 'Calendar' },
]

function initials(me: Me): string {
  const source = me.name?.trim() || me.registrations[0]?.teamName || me.email || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase()
}

// Active/idle styling shared by the inline (desktop) and scrollable (mobile) section nav. The
// underline hugs the bar bottom on desktop; on the shorter mobile row it sits just under the label.
const linkClass = (isActive: boolean, accent = false, compact = false) => {
  const idle = accent ? 'text-brand-3/70 hover:text-brand-3' : 'text-muted hover:text-ink-2'
  const active = accent ? 'text-brand-3' : 'text-ink'
  // Vertically center the label in the bar (so it lines up with the logo + auth controls) while
  // keeping the underline a touch above the bar's bottom edge. The border is in BOTH states
  // (transparent when idle) so the label never shifts when a link becomes active. Desktop: an h-11
  // box centered in the h-16 bar puts the text mid-bar with the underline ~10px up; the compact
  // mobile row fills its short height with the underline at the bottom.
  const box = compact ? 'h-full' : 'h-11'
  const border = isActive ? 'border-brand' : 'border-transparent'
  return `${isActive ? active : `${idle} transition-colors`} flex items-center border-b-2 ${border} ${box} shrink-0`
}

/** Top bar: wordmark + section nav + auth (Google sign-in / dev-login / signed-in identity). */
export function GlobalNav() {
  const { user, isAuthenticated, isAdmin, loginWithGoogle, logout, devLogin } = useAuth()
  const { data: active } = useActiveSeason()
  const notRegistered =
    !!user && !!active && !user.registrations.some((r) => r.seasonId === active.season.id)

  const sectionNav = (className: string, compact = false) => (
    <nav className={`${className} font-display text-[14px] font-semibold tracking-[0.08em] uppercase`}>
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => linkClass(isActive, false, compact)}>
          {l.label}
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => linkClass(isActive, true, compact)}>
          Admin
        </NavLink>
      )}
    </nav>
  )

  return (
    <div className="bg-black border-b-2 border-brand">
      <div className="flex items-center justify-between h-16 px-4 sm:px-[26px]">
        <div className="flex min-w-0 items-center gap-4 sm:gap-[30px]">
          <Logo />
          {/* desktop: inline section nav; mobile shows the scrollable row below instead */}
          {sectionNav('hidden gap-4 md:flex lg:gap-6')}
        </div>

      {isAuthenticated && user ? (
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {notRegistered && (
            <span className="flex shrink-0 items-center gap-[5px] h-5 px-2 rounded-[3px] bg-warn/10 border border-warn/35">
              <span className="h-[5px] w-[5px] rounded-full bg-warn" />
              <span className="font-mono text-[9px] tracking-[0.06em] text-warn">NOT REGISTERED</span>
            </span>
          )}
          {/* name/email replaces the avatar on mobile; when not registered the pill takes the slot
              instead (mobile has no room for both — the registration banner shows the name anyway) */}
          <div className={`${notRegistered ? 'hidden sm:block' : 'block'} min-w-0 text-right leading-tight`}>
            <div className="truncate font-sans text-[13px] font-semibold text-ink">
              {user.name ?? user.registrations[0]?.teamName ?? 'Player'}
            </div>
            <div className="truncate font-mono text-[10px] text-muted">{user.email}</div>
          </div>
          {/* initials avatar is desktop-only — the name/email replaces it on mobile */}
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand font-display text-[14px] font-bold text-ink sm:flex">
            {initials(user)}
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="shrink-0 font-display text-[12px] font-semibold tracking-[0.05em] uppercase text-muted hover:text-ink-2 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {import.meta.env.DEV && (
            // Dev-only shortcut — the API's dev-login (no Google needed locally).
            <button
              type="button"
              onClick={() => void devLogin('dev-user', 'Dev User', 'dev@dev.local')}
              className="font-mono text-[11px] tracking-[0.05em] uppercase text-muted-2 border border-line-2 rounded-[3px] px-3 h-9 hover:text-ink-2 transition-colors cursor-pointer"
            >
              Dev sign in
            </button>
          )}
          <button
            type="button"
            onClick={loginWithGoogle}
            className="flex items-center gap-[9px] h-10 px-4 bg-ink rounded-[3px] cursor-pointer"
          >
            <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.1h12.1c-.2 1.8-1.6 4.6-4.5 6.5l6.6 5.1C42.2 35.9 45 30.5 45 24z" />
              <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.6-5.1c-1.8 1.2-4.2 2.1-7.9 2.1-6 0-11.1-4-12.9-9.5l-6.8 5.3C7.5 40.8 15.1 46 24 46z" />
              <path fill="#FBBC05" d="M11.1 28.2c-.5-1.4-.8-2.9-.8-4.2s.3-2.9.7-4.2l-6.8-5.3C2.6 17.2 2 20.5 2 24s.6 6.8 2.2 9.5l6.9-5.3z" />
              <path fill="#EA4335" d="M24 10.5c3.4 0 5.6 1.4 6.9 2.6l5.8-5.7C33.1 3.9 28.9 2 24 2 15.1 2 7.5 7.2 4.3 14.5l6.8 5.3C12.9 14.5 18 10.5 24 10.5z" />
            </svg>
            <span className="font-sans text-[14px] font-semibold text-[#1a1a1a]">Sign in with Google</span>
          </button>
        </div>
      )}
      </div>

      {/* mobile-only second row: the section links the top bar can't fit horizontally, scrollable */}
      {sectionNav('flex gap-5 overflow-x-auto px-4 h-11 items-center border-t border-line/60 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', true)}
    </div>
  )
}
