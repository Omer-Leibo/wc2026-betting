import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { adminService, type AdminUser, type AdminStats } from '../services/adminService';
import { matchService } from '../services/matchService';
import type { Match, Team } from '../types';

type Tab = 'overview' | 'results' | 'users' | 'special';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Result entry state
  const [resultMatchId, setResultMatchId] = useState<number | null>(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [savingResult, setSavingResult] = useState(false);

  // Special results state
  const [specialType, setSpecialType] = useState<'CHAMPION' | 'TOP_SCORER' | 'TOP_ASSISTS'>('CHAMPION');
  const [specialTeamId, setSpecialTeamId] = useState<number | ''>('');
  const [specialPlayer, setSpecialPlayer] = useState('');
  const [savingSpecial, setSavingSpecial] = useState(false);

  useEffect(() => {
    Promise.all([adminService.getStats(), adminService.getUsers(), adminService.getPendingMatches(), matchService.getTeams()])
      .then(([s, u, m, t]) => { setStats(s); setUsers(u); setPendingMatches(m); setTeams(t); })
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, []);

  const handleEnterResult = async () => {
    if (resultMatchId === null) return;
    setSavingResult(true);
    try {
      await adminService.setMatchResult(resultMatchId, homeScore, awayScore);
      toast.success('Result saved and bets scored!');
      setPendingMatches(prev => prev.filter(m => m.id !== resultMatchId));
      setStats(prev => prev ? { ...prev, finishedCount: prev.finishedCount + 1 } : prev);
      setResultMatchId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save result');
    } finally {
      setSavingResult(false);
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await adminService.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success(`User ${username} deleted`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleScoreSpecial = async () => {
    setSavingSpecial(true);
    try {
      await adminService.scoreSpecialBets(
        specialType,
        specialType === 'CHAMPION' ? Number(specialTeamId) : undefined,
        specialType !== 'CHAMPION' ? specialPlayer : undefined,
      );
      toast.success(`${specialType} bets scored!`);
      setSpecialPlayer('');
      setSpecialTeamId('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to score special bets');
    } finally {
      setSavingSpecial(false);
    }
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`;

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded-full">Admin only</span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button className={tabClass('overview')} onClick={() => setTab('overview')}>Overview</button>
        <button className={tabClass('results')} onClick={() => setTab('results')}>Enter Results</button>
        <button className={tabClass('special')} onClick={() => setTab('special')}>Special Results</button>
        <button className={tabClass('users')} onClick={() => setTab('users')}>Users</button>
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Participants', value: stats.userCount },
            { label: 'Total Matches', value: stats.matchCount },
            { label: 'Finished', value: stats.finishedCount },
            { label: 'Total Bets', value: stats.betCount },
          ].map(({ label, value }) => (
            <div key={label} className="card text-center">
              <p className="text-3xl font-bold text-white">{value}</p>
              <p className="text-sm text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── ENTER RESULTS ── */}
      {tab === 'results' && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Select a match and enter the final score. Bets will be scored automatically.</p>

          {pendingMatches.length === 0 ? (
            <div className="card text-center py-8 text-gray-500">All matches have been scored!</div>
          ) : (
            <div className="space-y-2">
              {pendingMatches.map(match => (
                <div key={match.id}
                  className={`card cursor-pointer transition-all ${resultMatchId === match.id ? 'border-primary-500' : 'hover:border-gray-700'}`}
                  onClick={() => { setResultMatchId(match.id === resultMatchId ? null : match.id); setHomeScore(0); setAwayScore(0); }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-center w-24">
                        <p className="font-semibold text-white">{match.homeTeam.name}</p>
                        <p className="text-xs text-gray-500">{match.homeTeam.code}</p>
                      </div>
                      <span className="text-gray-600 font-bold">vs</span>
                      <div className="text-center w-24">
                        <p className="font-semibold text-white">{match.awayTeam.name}</p>
                        <p className="text-xs text-gray-500">{match.awayTeam.code}</p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-400">
                      <p>{match.stage.replace('_', ' ')}</p>
                      <p>{dayjs(match.matchDate).format('D MMM HH:mm')}</p>
                    </div>
                  </div>

                  {/* Score entry */}
                  {resultMatchId === match.id && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-4 flex-wrap"
                      onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">{match.homeTeam.code}</label>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setHomeScore(Math.max(0, homeScore - 1))} className="w-7 h-7 bg-gray-700 rounded hover:bg-gray-600 font-bold">−</button>
                          <span className="w-8 text-center text-xl font-bold">{homeScore}</span>
                          <button onClick={() => setHomeScore(homeScore + 1)} className="w-7 h-7 bg-gray-700 rounded hover:bg-gray-600 font-bold">+</button>
                        </div>
                      </div>
                      <span className="text-gray-600 font-bold">–</span>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">{match.awayTeam.code}</label>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setAwayScore(Math.max(0, awayScore - 1))} className="w-7 h-7 bg-gray-700 rounded hover:bg-gray-600 font-bold">−</button>
                          <span className="w-8 text-center text-xl font-bold">{awayScore}</span>
                          <button onClick={() => setAwayScore(awayScore + 1)} className="w-7 h-7 bg-gray-700 rounded hover:bg-gray-600 font-bold">+</button>
                        </div>
                      </div>
                      <button onClick={handleEnterResult} disabled={savingResult} className="btn-primary ml-auto">
                        {savingResult ? 'Saving...' : 'Confirm Result'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SPECIAL RESULTS ── */}
      {tab === 'special' && (
        <div className="card space-y-4 max-w-md">
          <h2 className="font-semibold">Score Special Bets</h2>
          <p className="text-gray-400 text-sm">Enter the tournament winner to score all special bets.</p>

          <div>
            <label className="label">Bet type</label>
            <select className="input" value={specialType} onChange={e => setSpecialType(e.target.value as typeof specialType)}>
              <option value="CHAMPION">🏆 Champion</option>
              <option value="TOP_SCORER">⚽ Top Scorer</option>
              <option value="TOP_ASSISTS">🎯 Top Assists</option>
            </select>
          </div>

          {specialType === 'CHAMPION' ? (
            <div>
              <label className="label">Winner team</label>
              <select className="input" value={specialTeamId} onChange={e => setSpecialTeamId(Number(e.target.value))}>
                <option value="">Select team...</option>
                {['A','B','C','D','E','F','G','H','I','J','K','L'].map(g => (
                  <optgroup key={g} label={`Group ${g}`}>
                    {teams.filter(t => t.group === g).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Player name (must match bets exactly)</label>
              <input type="text" className="input" placeholder="e.g. Mbappé" value={specialPlayer} onChange={e => setSpecialPlayer(e.target.value)} />
            </div>
          )}

          <button onClick={handleScoreSpecial} disabled={savingSpecial} className="btn-primary w-full">
            {savingSpecial ? 'Scoring...' : 'Score Bets'}
          </button>
        </div>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">
                  {u.username}
                  {u.role === 'ADMIN' && <span className="ml-2 text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded-full">Admin</span>}
                </p>
                <p className="text-sm text-gray-500">{u.email}</p>
                <p className="text-xs text-gray-600 mt-0.5">{u._count.matchBets} match bets · {u._count.specialBets} special bets · joined {dayjs(u.createdAt).format('D MMM YYYY')}</p>
              </div>
              <button
                onClick={() => handleDeleteUser(u.id, u.username)}
                className="btn-danger text-xs py-1.5 px-3 shrink-0">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
