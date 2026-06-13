import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useBetAlertStore } from '../../store/betAlertStore';
import { useLang } from '../../i18n/LanguageContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';

// ── Language toggle button ─────────────────────────────────────────────────────
function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
      title={lang === 'en' ? 'Switch to Hebrew' : 'עבור לאנגלית'}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-heading font-bold
                 tracking-wider transition-all border"
      style={{
        background: 'rgba(42,57,141,0.25)',
        borderColor: 'rgba(42,57,141,0.5)',
        color: '#94a0d8',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(42,57,141,0.50)';
        (e.currentTarget as HTMLElement).style.color = '#ffffff';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(42,57,141,0.25)';
        (e.currentTarget as HTMLElement).style.color = '#94a0d8';
      }}
    >
      {lang === 'en' ? '🇮🇱 עב' : '🇬🇧 EN'}
    </button>
  );
}

// ── Notification bell ──────────────────────────────────────────────────────────
function NotificationBell() {
  const { supported, subscribed, loading, toggle } = usePushNotifications();
  if (!supported) return null;

  const handleClick = async () => {
    const wasSubscribed = subscribed;
    await toggle();
    if (!wasSubscribed) {
      if (Notification.permission === 'denied') {
        toast.error('Notifications blocked — enable them in browser settings.');
      } else {
        toast.success('🔔 Bet reminders enabled!');
      }
    } else {
      toast('Notifications turned off', { icon: '🔕' });
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={subscribed ? 'Disable bet reminders' : 'Enable bet reminders (1 h before kickoff)'}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
      style={{
        background: subscribed ? 'rgba(245,166,35,0.18)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${subscribed ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.1)'}`,
        color: subscribed ? '#F5A623' : '#6b7280',
        opacity: loading ? 0.5 : 1,
      }}
    >
      {subscribed ? (
        /* Bell filled */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
      ) : (
        /* Bell with slash */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42V16l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.43.12l5.93 9.88z"/>
        </svg>
      )}
    </button>
  );
}

export default function Layout() {
  const { user, logout }  = useAuthStore();
  const navigate           = useNavigate();
  const { t, isRTL }       = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const unbettedCount = useBetAlertStore(s => s.unbettedCount);

  const handleLogout = () => { logout(); navigate('/login'); };

  const links = [
    { to: '/',             label: t.nav.dashboard,   end: true  },
    { to: '/matches',      label: t.nav.matches,      end: false },
    { to: '/standings',    label: t.nav.standings,    end: false },
    { to: '/special-bets', label: t.nav.specialBets,  end: false },
    { to: '/all-bets',     label: t.nav.allBets,      end: false },
    { to: '/leaderboard',  label: t.nav.leaderboard,  end: false },
    { to: '/bracket',      label: t.nav.bracket,      end: false },
    { to: '/rules',        label: t.nav.rules,        end: false },
    ...(user?.role === 'ADMIN'
      ? [{ to: '/admin', label: t.nav.admin, end: false }]
      : []),
  ];

  const LINK_COLORS = [
    'from-red-500 to-red-700',       // Dashboard
    'from-blue-500 to-primary-700',  // Matches
    'from-cyan-500 to-blue-700',     // Standings
    'from-gold-500 to-gold-700',     // Special Bets
    'from-green-500 to-green-700',   // All Bets
    'from-gold-400 to-yellow-600',   // Leaderboard
    'from-purple-500 to-indigo-700', // Bracket
    'from-gray-400 to-gray-600',     // Rules
    'from-primary-400 to-primary-600', // Admin
  ];

  return (
    <div className="min-h-screen flex flex-col">

      {/* Tricolor stripe */}
      <div className="tricolor-bar w-full" />

      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 px-4 py-3 border-b"
        style={{
          background: 'linear-gradient(135deg, rgba(5,10,30,0.97) 0%, rgba(12,24,65,0.97) 100%)',
          borderBottomColor: 'rgba(42,57,141,0.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">

          {/* Logo — click to go home */}
          <NavLink
            to="/"
            end
            className={`flex items-center gap-3 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <img
              src="/wc2026-official-logo.png"
              alt="FIFA World Cup 2026"
              className="h-12 w-auto"
              style={{ filter: 'drop-shadow(0 0 10px rgba(245,166,35,0.40))' }}
            />
            <div className={`flex flex-col leading-tight ${isRTL ? 'items-end' : ''}`}>
              <span
                className="font-display text-xl tracking-widest uppercase"
                style={{
                  background: 'linear-gradient(135deg, #E61D25 0%, #ffffff 50%, #2A398D 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  lineHeight: 1.1,
                }}
              >
                {t.nav.appName}
              </span>
              <span
                className="font-display text-3xl tracking-[0.18em] uppercase text-white"
                style={{ lineHeight: 1 }}
              >
                {t.nav.appYear}
              </span>
              <span className="text-[9px] tracking-[0.22em] uppercase text-gray-500 mt-0.5 hidden sm:block">
                {t.nav.subtitle}
              </span>
            </div>
          </NavLink>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map((l, i) => {
              const showBadge = l.to === '/matches' && unbettedCount > 0;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    isActive
                      ? `relative px-3 py-1.5 rounded-lg text-sm font-heading font-bold tracking-wide transition-all text-white bg-gradient-to-r ${LINK_COLORS[i] ?? 'from-primary-600 to-primary-800'} shadow-lg`
                      : 'relative px-3 py-1.5 rounded-lg text-sm font-heading font-semibold tracking-wide transition-all text-gray-400 hover:text-white hover:bg-white/10'
                  }
                >
                  {l.label}
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1 min-w-[17px] h-[17px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow">
                      {unbettedCount > 99 ? '99+' : unbettedCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Right side */}
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <LangToggle />
            <NotificationBell />

            <span className="hidden md:inline text-sm text-gray-400">
              {user?.username}
              {user?.role === 'ADMIN' && (
                <span
                  className="text-xs text-white px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'linear-gradient(135deg,#E61D25,#2A398D)', marginInlineStart: '0.5rem' }}
                >
                  {t.common.admin}
                </span>
              )}
            </span>
            <button
              onClick={handleLogout}
              className="hidden md:inline-flex btn-secondary text-xs py-1.5 px-3"
            >
              {t.nav.logout}
            </button>

            {/* Hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div
            className="md:hidden mt-3 space-y-1 pt-3 max-w-7xl mx-auto"
            style={{ borderTop: '1px solid rgba(42,57,141,0.3)' }}
          >
            {links.map((l, i) => {
              const showBadge = l.to === '/matches' && unbettedCount > 0;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    isActive
                      ? `flex items-center justify-between px-4 py-3 rounded-lg text-base font-heading font-bold tracking-wide text-white bg-gradient-to-r ${LINK_COLORS[i] ?? 'from-primary-600 to-primary-800'}`
                      : 'flex items-center justify-between px-4 py-3 rounded-lg text-base font-heading font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors'
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                  {showBadge && (
                    <span className="min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {unbettedCount > 99 ? '99+' : unbettedCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
            <div
              className="pt-3 mt-2 flex items-center justify-between px-1"
              style={{ borderTop: '1px solid rgba(42,57,141,0.3)' }}
            >
              <span className="text-sm text-gray-400">
                {user?.username}
                {user?.role === 'ADMIN' && (
                  <span
                    className="text-xs text-white px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'linear-gradient(135deg,#E61D25,#2A398D)', marginInlineStart: '0.5rem' }}
                  >
                    {t.common.admin}
                  </span>
                )}
              </span>
              <button onClick={handleLogout} className="btn-secondary text-sm py-1.5">
                {t.nav.logout}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Page content */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <Outlet />
      </main>

      {/* Footer */}
      <footer
        className="py-3 text-center text-xs tracking-widest font-display"
        style={{ borderTop: '1px solid rgba(42,57,141,0.2)', color: 'rgba(112,128,200,0.5)' }}
      >
        FIFA WORLD CUP 2026 · {t.nav.subtitle.toUpperCase()}
      </footer>
    </div>
  );
}
