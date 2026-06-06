import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useLang } from '../i18n/LanguageContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { t } = useLang();
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { user, token } = await authService.register(username, email, password);
      setAuth(user, token);
      toast.success(`${t.auth.createAccount}! ${user.username} 🎉`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 relative overflow-hidden">

      {/* Auth page vivid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 60% 55% at 85% 10%,  rgba(230,29,37,0.30)  0%, transparent 65%),
          radial-gradient(ellipse 55% 50% at 15% 90%,  rgba(60,172,59,0.25)  0%, transparent 65%),
          radial-gradient(ellipse 40% 35% at 20% 15%,  rgba(42,57,141,0.30)  0%, transparent 55%)
        `,
      }} />

      <div className="w-full max-w-sm relative z-10 animate-fade-up">

        {/* Hero header */}
        <div className="text-center mb-6">
          <img src="/wc2026-official-logo.png" alt="FIFA World Cup 2026"
            className="h-28 w-auto mx-auto mb-2"
            style={{ filter: 'drop-shadow(0 0 20px rgba(245,166,35,0.45))' }}
          />
          <h1
            className="font-display text-5xl tracking-[0.12em] uppercase"
            style={{
              background: 'linear-gradient(135deg, #E61D25 0%, #ffffff 45%, #2A398D 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t.nav.appName}
          </h1>
          <p className="text-gray-500 text-xs tracking-widest uppercase mt-1">{t.auth.createYour}</p>
        </div>

        {/* Register card */}
        <div className="card-glow space-y-4">
          <h3
            className="font-heading text-2xl text-center tracking-wider font-bold"
            style={{ color: '#7a9fff' }}
          >
            {t.auth.register}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label">{t.auth.username}</label>
              <input type="text" className="input" placeholder="e.g. johndoe"
                value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={20} />
              <p className="text-xs text-gray-500 mt-1">{t.auth.usernameHint}</p>
            </div>
            <div>
              <label className="label">{t.auth.email}</label>
              <input type="email" className="input" placeholder={t.auth.emailPlaceholder}
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">{t.auth.password}</label>
              <input type="password" className="input" placeholder={t.auth.pwPlaceholder}
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <label className="label">{t.auth.confirmPassword}</label>
              <input type="password" className="input" placeholder="••••••••"
                value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary w-full text-base py-2.5 mt-1" disabled={loading}>
              {loading ? t.auth.creatingAccount : t.auth.createAccount}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 mt-5 text-sm">
          {t.auth.haveAccount}{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 font-semibold">
            {t.auth.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
