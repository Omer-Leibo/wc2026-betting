import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`;

  // Mobile nav link — closes menu on tap
  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'text-gray-300 hover:text-white hover:bg-gray-800'
    }`;

  const links = [
    { to: '/',            label: '🏠 Dashboard',    end: true  },
    { to: '/matches',     label: '📅 Matches',       end: false },
    { to: '/special-bets',label: '⭐ Special Bets',  end: false },
    { to: '/all-bets',    label: '👥 All Bets',      end: false },
    { to: '/leaderboard', label: '🏆 Leaderboard',   end: false },
    ...(user?.role === 'ADMIN' ? [{ to: '/admin', label: '⚙️ Admin', end: false }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <span className="text-xl font-bold text-white shrink-0">⚽ WC2026</span>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
                {l.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Username — desktop only */}
            <span className="hidden md:inline text-sm text-gray-400">
              {user?.username}
              {user?.role === 'ADMIN' && (
                <span className="ml-2 text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">Admin</span>
              )}
            </span>

            {/* Logout — desktop only */}
            <button onClick={handleLogout} className="hidden md:inline-flex btn-secondary text-sm py-1.5">
              Logout
            </button>

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                // X icon
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // Hamburger icon
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden mt-3 space-y-1 border-t border-gray-800 pt-3">
            {links.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={mobileNavClass}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
            <div className="border-t border-gray-800 pt-3 mt-2 flex items-center justify-between px-1">
              <span className="text-sm text-gray-400">
                {user?.username}
                {user?.role === 'ADMIN' && (
                  <span className="ml-2 text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">Admin</span>
                )}
              </span>
              <button onClick={handleLogout} className="btn-secondary text-sm py-1.5">
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Page content */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
