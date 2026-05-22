import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-xl font-bold text-white">⚽ WC2026</span>
          <div className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>Dashboard</NavLink>
            <NavLink to="/matches" className={navClass}>Matches</NavLink>
            <NavLink to="/special-bets" className={navClass}>Special Bets</NavLink>
            <NavLink to="/leaderboard" className={navClass}>Leaderboard</NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin" className={navClass}>Admin</NavLink>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
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
      </nav>

      {/* Page content */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
