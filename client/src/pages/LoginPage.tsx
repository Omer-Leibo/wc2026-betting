import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useLang } from '../i18n/LanguageContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { t } = useLang();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, token } = await authService.login(email, password);
      setAuth(user, token);
      toast.success(`${t.auth.signIn}! ${user.username}`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 relative overflow-hidden">
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 60% 55% at 15% 10%,  rgba(230,29,37,0.35)  0%, transparent 65%),
          radial-gradient(ellipse 55% 50% at 85% 90%,  rgba(42,57,141,0.40)  0%, transparent 65%),
          radial-gradient(ellipse 40% 35% at 80% 15%,  rgba(60,172,59,0.18)  0%, transparent 55%),
          radial-gradient(ellipse 35% 30% at 20% 85%,  rgba(42,57,141,0.25)  0%, transparent 55%)
        `,
      }} />

      <div className="w-full max-w-sm relative z-10 animate-fade-up">

        {/* WC hero */}
        <div className="text-center mb-8">
          <img
            src="/wc2026-official-logo.png"
            alt="FIFA World Cup 2026"
            className="h-40 w-auto mx-auto mb-1"
            style={{ filter: 'drop-shadow(0 0 24px rgba(245,166,35,0.50))' }}
          />
          <h1
            className="font-display text-6xl tracking-[0.12em] uppercase"
            style={{
              background: 'linear-gradient(135deg, #E61D25 0%, #ffffff 45%, #2A398D 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t.nav.appName}
          </h1>
          <h2
            className="font-display text-7xl tracking-[0.15em] uppercase text-white"
            style={{ lineHeight: 1, marginTop: '-6px' }}
          >
            {t.nav.appYear}
          </h2>
          <div className="tricolor-bar rounded-full w-32 mx-auto mt-4 mb-2" style={{ height: '3px' }} />
          <p className="text-gray-400 text-xs tracking-widest uppercase mt-2">{t.auth.subtitle}</p>
        </div>

        {/* Login card */}
        <div className="card-glow space-y-4">
          <h3 className="font-heading text-2xl text-center tracking-wider font-bold" style={{ color: '#7a9fff' }}>
            {t.auth.signInTo}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t.auth.email}</label>
              <input type="email" className="input" placeholder={t.auth.emailPlaceholder}
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">{t.auth.password}</label>
              <input type="password" className="input" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary w-full text-base py-2.5 mt-2" disabled={loading}>
              {loading ? t.auth.signingIn : t.auth.signIn}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 mt-5 text-sm">
          {t.auth.noAccount}{' '}
          <Link to="/register" className="text-primary-400 hover:text-primary-300 font-semibold">
            {t.auth.register}
          </Link>
        </p>
      </div>
    </div>
  );
}
