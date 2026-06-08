import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { betService } from '../services/betService';
import { matchService } from '../services/matchService';
import { leaderboardService } from '../services/leaderboardService';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useBetAlertStore } from '../store/betAlertStore';
import { useLang } from '../i18n/LanguageContext';
import type { MatchBet, SpecialBet, LeaderboardEntry } from '../types';
import dayjs from 'dayjs';

// ── Countdown helper ─────────────────────────────────────────────────────────
function formatTimeUntil(dateStr: string): { text: string; urgent: boolean } {
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return { text: '', urgent: true };
  const totalMins = Math.floor(ms / 60_000);
  const days  = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins  = totalMins % 60;
  const text  = days >= 1 ? `${days}d ${hours}h` : hours >= 1 ? `${hours}h ${mins}m` : `${mins}m`;
  return { text, urgent: ms < 60 * 60 * 1000 };
}

// ── Colorful stat card ──────────────────────────────────────────────────────
function StatCard({
  label, value, sub, variant,
}: {
  label: string;
  value: string | number;
  sub?: string;
  variant: 'gold' | 'blue' | 'green' | 'red';
}) {
  const colors = {
    gold:  { className: 'stat-card-gold',  valueColor: '#F5A623' },
    blue:  { className: 'stat-card-blue',  valueColor: '#7a9fff' },
    green: { className: 'stat-card-green', valueColor: '#7ada7c' },
    red:   { className: 'stat-card-red',   valueColor: '#ff8080' },
  } as const;
  const { className, valueColor } = colors[variant];

  return (
    <div className={`${className} text-center`}>
      <p
        className="text-4xl font-heading tracking-wide"
        style={{ fontWeight: 900, color: valueColor }}
      >
        {value}
      </p>
      <p className="text-sm text-gray-300 mt-1 font-semibold">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { t } = useLang();
  const [matchBets, setMatchBets]     = useState<MatchBet[]>([]);
  const [specialBets, setSpecialBets] = useState<SpecialBet[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]         = useState(true);

  // Countdown tick — re-renders countdown text every 30 s
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { unbettedCount, nextUnbettedMatch } = useBetAlertStore();
  const updateBetAlert = useBetAlertStore(s => s.update);

  // Change password modal
  const [showChangePw, setShowChangePw]     = useState(false);
  const [currentPw, setCurrentPw]           = useState('');
  const [newPw, setNewPw]                   = useState('');
  const [confirmPw, setConfirmPw]           = useState('');
  const [changingPw, setChangingPw]         = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    if (newPw.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setChangingPw(true);
    try {
      await authService.changePassword(currentPw, newPw);
      toast.success('Password changed successfully!');
      setShowChangePw(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setChangingPw(false); }
  };

  useEffect(() => {
    Promise.all([betService.getMyBets(), leaderboardService.get(), matchService.getAll()])
      .then(([bets, lb, matches]) => {
        setMatchBets(bets.matchBets);
        setSpecialBets(bets.specialBets);
        setLeaderboard(lb.entries);
        updateBetAlert(matches, bets.matchBets);
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [updateBetAlert]);

  const myEntry     = leaderboard.find(e => e.userId === user?.id);
  const finishedBets = matchBets.filter(b => b.match?.status === 'FINISHED');
  const upcomingBets = matchBets.filter(b => b.match?.status === 'UPCOMING');

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-up">

      {/* ── Change password modal ─────────────────────────────────────────── */}
      {showChangePw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="card max-w-sm w-full space-y-4" style={{ border: '1px solid rgba(42,57,141,0.5)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">🔒 {t.dashboard.changePassword}</h2>
              <button type="button" onClick={() => setShowChangePw(false)} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="label">{t.dashboard.currentPassword}</label>
                <input type="password" className="input" value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)} required autoComplete="current-password" />
              </div>
              <div>
                <label className="label">{t.dashboard.newPassword}</label>
                <input type="password" className="input" value={newPw}
                  onChange={e => setNewPw(e.target.value)} required minLength={6} autoComplete="new-password" />
              </div>
              <div>
                <label className="label">{t.dashboard.confirmPassword}</label>
                <input type="password" className="input" value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)} required autoComplete="new-password" />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={changingPw}>
                {changingPw ? t.dashboard.saving : t.dashboard.changePasswordBtn}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <div>
        <h1
          className="font-display text-5xl tracking-wider"
          style={{
            background: 'linear-gradient(135deg, #E61D25 0%, #ffffff 45%, #2A398D 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {t.dashboard.title}
        </h1>
        <div className="flex items-center gap-2.5 mt-2 flex-wrap">
          <p className="text-gray-400 text-sm">{t.dashboard.welcome}</p>
          <span className="text-white font-semibold text-sm">{user?.username}</span>
          <button
            onClick={() => setShowChangePw(true)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium transition-all shrink-0"
            style={{
              background: 'rgba(42,57,141,0.22)',
              border: '1px solid rgba(42,57,141,0.55)',
              color: '#9ca3af',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,57,141,0.9)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,57,141,0.55)'; }}
          >
            🔒 {t.dashboard.changePassword}
          </button>
          <span className="text-gray-600 text-sm hidden sm:inline">· {t.dashboard.subtitle}</span>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label={t.dashboard.totalPoints}
          value={myEntry?.totalPoints ?? 0}
          sub={myEntry
            ? `${t.dashboard.rank}${myEntry.rank} ${t.dashboard.of} ${leaderboard.length}`
            : t.dashboard.noResults}
          variant="gold"
        />
        <StatCard label={t.dashboard.matchBets} value={matchBets.length} sub={t.dashboard.placed} variant="blue" />
        <StatCard label={t.dashboard.exactScores} value={myEntry?.exactScores ?? 0} sub={t.dashboard.allTime} variant="green" />
        <StatCard label={t.dashboard.correctResults} value={myEntry?.correctScores ?? 0} sub={t.dashboard.allTime} variant="red" />
      </div>

      {/* ── Unbet warning card ───────────────────────────────────────────── */}
      {unbettedCount > 0 && (() => {
        const countdown = nextUnbettedMatch ? formatTimeUntil(nextUnbettedMatch.matchDate) : null;
        const urgent = countdown?.urgent ?? false;
        return (
          <Link
            to="/matches"
            className="block rounded-xl px-4 py-3 transition-opacity hover:opacity-90"
            style={{
              background: urgent
                ? 'linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(185,28,28,0.10) 100%)'
                : 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(217,119,6,0.10) 100%)',
              border: `1px solid ${urgent ? 'rgba(220,38,38,0.45)' : 'rgba(245,158,11,0.45)'}`,
            }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className={`text-xl ${urgent ? 'animate-pulse' : ''}`}>
                  {urgent ? '🚨' : '⚠️'}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${urgent ? 'text-red-300' : 'text-amber-300'}`}>
                    {unbettedCount === 1 ? `1 ${t.dashboard.unbettedOne}` : `${unbettedCount} ${t.dashboard.unbettedMany}`}
                  </p>
                  {nextUnbettedMatch && countdown && countdown.text && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.dashboard.nextKicksOff}:{' '}
                      <span className={`font-bold ${urgent ? 'text-red-300' : 'text-amber-300'}`}>
                        {countdown.text}
                      </span>
                      {' '}— {nextUnbettedMatch.homeTeam.name} vs {nextUnbettedMatch.awayTeam.name}
                    </p>
                  )}
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 ${
                urgent ? 'bg-red-900/40 text-red-300 border border-red-700/50' : 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
              }`}>
                {t.dashboard.placeBets}
              </span>
            </div>
          </Link>
        );
      })()}

      {/* ── Special bets status ──────────────────────────────────────────── */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl text-white">{t.dashboard.specialBets}</h2>
          <Link to="/special-bets" className="text-xs text-primary-400 hover:text-primary-300 font-semibold">
            {t.dashboard.editBets}
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t.dashboard.champion,   type: 'CHAMPION'    as const, color: 'rgba(245,166,35,0.15)',   border: '#F5A623' },
            { label: t.dashboard.topScorer,  type: 'TOP_SCORER'  as const, color: 'rgba(42,57,141,0.20)',    border: '#2A398D' },
            { label: t.dashboard.topAssists, type: 'TOP_ASSISTS' as const, color: 'rgba(60,172,59,0.18)',    border: '#3CAC3B' },
          ].map(({ label, type, color, border }) => {
            const bet = specialBets.find(b => b.type === type);
            return (
              <div
                key={type}
                className="rounded-xl p-3 text-center"
                style={{
                  background: color,
                  border: `1px solid ${border}44`,
                  boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 16px ${border}22`,
                }}
              >
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-sm font-semibold ${bet ? 'text-white' : 'text-gray-600'}`}>
                  {bet
                    ? type === 'CHAMPION' ? (bet.team?.name ?? '—') : (bet.playerName ?? '—')
                    : t.dashboard.notPlaced}
                </p>
                {bet?.pointsAwarded !== undefined && (
                  <p className={`text-xs mt-1 font-bold ${bet.pointsAwarded > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bet.pointsAwarded > 0 ? `+${bet.pointsAwarded} ${t.common.pts}` : '✗'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">

        {/* ── Recent results ───────────────────────────────────────────── */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl text-white">{t.dashboard.recentResults}</h2>
            <Link to="/matches" className="text-xs text-primary-400 hover:text-primary-300 font-semibold">
              {t.dashboard.allMatches}
            </Link>
          </div>
          {finishedBets.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.dashboard.noFinished}</p>
          ) : (
            <div className="space-y-2">
              {finishedBets.slice(-5).reverse().map(bet => {
                const m = bet.match!;
                const isExact = bet.predictedHome === m.homeScore && bet.predictedAway === m.awayScore;
                const pts = bet.pointsAwarded ?? 0;
                return (
                  <div key={bet.id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300 truncate flex-1">
                      {m.homeTeam?.code} {m.homeScore}–{m.awayScore} {m.awayTeam?.code}
                    </span>
                    <span className={`ml-2 font-semibold shrink-0 ${isExact ? 'text-yellow-400' : pts > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {isExact ? '⭐' : pts > 0 ? '✓' : '✗'} +{pts}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Upcoming bets ────────────────────────────────────────────── */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl text-white">{t.dashboard.upcomingBets}</h2>
            <Link to="/matches" className="text-xs text-primary-400 hover:text-primary-300 font-semibold">
              {t.dashboard.placeBets}
            </Link>
          </div>
          {upcomingBets.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.dashboard.noUpcoming}</p>
          ) : (
            <div className="space-y-2">
              {upcomingBets.slice(0, 5).map(bet => (
                <div key={bet.id} className="flex justify-between items-center text-sm">
                  <span className="text-gray-300 truncate flex-1">
                    {bet.match?.homeTeam?.code} vs {bet.match?.awayTeam?.code}
                  </span>
                  <span className="text-gray-400 shrink-0 ml-2">
                    {bet.predictedHome}–{bet.predictedAway}
                  </span>
                  <span className="text-gray-600 shrink-0 ml-2 text-xs">
                    {dayjs(bet.match?.matchDate).format('D MMM')}
                  </span>
                </div>
              ))}
              {upcomingBets.length > 5 && (
                <p className="text-xs text-gray-500">+{upcomingBets.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
