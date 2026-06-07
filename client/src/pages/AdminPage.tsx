import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { adminService, type AdminUser, type AdminStats, type SyncStatus, type SyncResult, type BackupMeta } from '../services/adminService';
import { matchService } from '../services/matchService';
import type { Match, Team, Player } from '../types';
import { Flag } from '../components/Flag';
import { TeamPicker } from '../components/pickers/TeamPicker';
import { PlayerPicker } from '../components/pickers/PlayerPicker';

dayjs.extend(relativeTime);

type Tab = 'overview' | 'results' | 'users' | 'special' | 'sync' | 'backup';

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab]               = useState<Tab>('overview');
  const [stats, setStats]           = useState<AdminStats | null>(null);
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [teams, setTeams]           = useState<Team[]>([]);
  const [players, setPlayers]       = useState<Player[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  // Result entry state
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [homeScore, setHomeScore]   = useState('');
  const [awayScore, setAwayScore]   = useState('');
  const [savingResult, setSavingResult] = useState(false);

  // Special results state
  const [specialType, setSpecialType]   = useState<'CHAMPION' | 'TOP_SCORER' | 'TOP_ASSISTS'>('CHAMPION');
  const [specialTeamId, setSpecialTeamId] = useState<number | ''>('');
  const [specialPlayer, setSpecialPlayer] = useState('');
  const [savingSpecial, setSavingSpecial] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus]       = useState<SyncStatus | null>(null);
  const [syncing, setSyncing]             = useState(false);
  const [syncingPlayers, setSyncingPlayers] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Backup state
  const [backups, setBackups]             = useState<BackupMeta[]>([]);
  const [backingUp, setBackingUp]         = useState(false);

  useEffect(() => {
    Promise.all([
      adminService.getStats(),
      adminService.getUsers(),
      adminService.getPendingMatches(),
      matchService.getTeams(),
      matchService.getPlayers(),
      adminService.getSyncStatus().catch(() => null),
      adminService.listBackups().catch(() => []),
    ])
      .then(([s, u, m, t, p, ss, bk]) => {
        setStats(s); setUsers(u); setAllMatches(m); setTeams(t); setPlayers(p);
        if (ss) setSyncStatus(ss);
        setBackups(bk);
      })
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, []);

  // ── Sync handlers ────────────────────────────────────────────────────────
  const handleSync = async (type: 'full' | 'live') => {
    setSyncing(true); setLastSyncResult(null);
    try {
      const result = type === 'full' ? await adminService.syncAll() : await adminService.syncLive();
      setLastSyncResult(result);
      const ss = await adminService.getSyncStatus().catch(() => null);
      if (ss) setSyncStatus(ss);
      toast.success(`Sync complete! ${result.matchesUpdated} matches updated`);
      adminService.getPendingMatches().then(setAllMatches);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Sync failed');
    } finally { setSyncing(false); }
  };

  const handleSyncPlayers = async () => {
    setSyncingPlayers(true);
    try {
      const count = await adminService.syncPlayers();
      toast.success(`${count} players synced!`);
      matchService.getPlayers().then(setPlayers);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Player sync failed');
    } finally { setSyncingPlayers(false); }
  };

  // ── Result entry ─────────────────────────────────────────────────────────
  const openEdit = (match: Match) => {
    setEditingId(match.id);
    setHomeScore(match.homeScore != null ? String(match.homeScore) : '');
    setAwayScore(match.awayScore != null ? String(match.awayScore) : '');
  };

  const handleEnterResult = async () => {
    if (editingId === null) return;
    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) { toast.error('Enter valid scores (0 or more)'); return; }
    setSavingResult(true);
    try {
      const updated = await adminService.setMatchResult(editingId, h, a);
      setAllMatches(prev => prev.map(m => m.id === editingId ? { ...m, ...updated } : m));
      setStats(prev => prev ? { ...prev, finishedCount: prev.finishedCount + 1 } : prev);
      toast.success('Result saved and bets scored!');
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save result');
    } finally { setSavingResult(false); }
  };

  // ── Special results ──────────────────────────────────────────────────────
  const handleScoreSpecial = async () => {
    setSavingSpecial(true);
    try {
      await adminService.scoreSpecialBets(
        specialType,
        specialType === 'CHAMPION' ? Number(specialTeamId) : undefined,
        specialType !== 'CHAMPION' ? specialPlayer : undefined,
      );
      toast.success(`${specialType} bets scored!`);
      setSpecialPlayer(''); setSpecialTeamId('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to score special bets');
    } finally { setSavingSpecial(false); }
  };

  // ── Manual backup ────────────────────────────────────────────────────────
  const handleBackup = async () => {
    setBackingUp(true);
    try {
      await adminService.triggerBackup();
      const bk = await adminService.listBackups();
      setBackups(bk);
      toast.success('Backup created!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Backup failed');
    } finally { setBackingUp(false); }
  };

  // ── Delete user ──────────────────────────────────────────────────────────
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

  // ── Reset password ────────────────────────────────────────────────────────
  const [resetModal, setResetModal] = useState<{ username: string; tempPassword: string } | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);

  const handleResetPassword = async (id: number, username: string) => {
    if (!confirm(`Reset password for "${username}"? A temporary password will be generated.`)) return;
    setResettingId(id);
    try {
      const tempPassword = await adminService.resetUserPassword(id);
      setResetModal({ username, tempPassword });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingId(null);
    }
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`;

  const displayMatches = showOnlyPending
    ? allMatches.filter(m => m.status !== 'FINISHED')
    : allMatches;

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Reset password modal ──────────────────────────────────────────── */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="card max-w-sm w-full space-y-4" style={{ border: '1px solid rgba(245,166,35,0.4)' }}>
            <h2 className="font-semibold text-lg">🔑 Temporary Password</h2>
            <p className="text-gray-400 text-sm">
              Password for <span className="text-white font-semibold">{resetModal.username}</span> has been reset.
              Share this with them — they should change it after logging in.
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 text-center text-xl font-mono font-bold tracking-widest rounded-lg px-4 py-3 select-all"
                style={{ background: 'rgba(245,166,35,0.12)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.3)' }}
              >
                {resetModal.tempPassword}
              </code>
              <button
                className="btn-secondary text-sm px-3 py-3"
                onClick={() => { navigator.clipboard.writeText(resetModal.tempPassword); toast.success('Copied!'); }}
              >
                📋
              </button>
            </div>
            <button className="btn-primary w-full" onClick={() => setResetModal(null)}>Done</button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded-full">Admin only</span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button className={tabClass('overview')} onClick={() => setTab('overview')}>Overview</button>
        <button className={tabClass('results')}  onClick={() => setTab('results')}>Enter Results</button>
        <button className={tabClass('special')}  onClick={() => setTab('special')}>Special Results</button>
        <button className={tabClass('users')}    onClick={() => setTab('users')}>Users</button>
        <button className={tabClass('sync')}     onClick={() => setTab('sync')}>
          🔄 Live Sync
          {syncStatus?.lastSync && (
            <span className="ml-1 text-xs opacity-70">{dayjs(syncStatus.lastSync.syncedAt).fromNow()}</span>
          )}
        </button>
        <button className={tabClass('backup')}   onClick={() => setTab('backup')}>
          💾 Backups
          {backups.length > 0 && (
            <span className="ml-1 text-xs opacity-70">{backups.length}</span>
          )}
        </button>
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
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

      {/* ── ENTER RESULTS ────────────────────────────────────────────────── */}
      {tab === 'results' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-gray-400 text-sm">
              Click a match to enter or update its score. Bets are scored automatically.
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showOnlyPending} onChange={e => setShowOnlyPending(e.target.checked)}
                className="rounded" />
              Show only pending
            </label>
          </div>

          {displayMatches.length === 0 ? (
            <div className="card text-center py-8 text-gray-500">No matches to show.</div>
          ) : (
            <div className="space-y-2">
              {displayMatches.map(match => (
                <div key={match.id}
                  className={`card cursor-pointer transition-all ${editingId === match.id ? 'border-primary-500' : 'hover:border-gray-700'}`}
                  onClick={() => editingId === match.id ? setEditingId(null) : openEdit(match)}>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {/* Teams */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Flag url={match.homeTeam.flagUrl} name={match.homeTeam.name} size="sm" />
                        <span className="font-semibold text-white text-sm">{match.homeTeam.name}</span>
                      </div>
                      {match.status === 'FINISHED' ? (
                        <span className="text-white font-bold px-2">{match.homeScore} – {match.awayScore}</span>
                      ) : (
                        <span className="text-gray-600 font-bold px-2">vs</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white text-sm">{match.awayTeam.name}</span>
                        <Flag url={match.awayTeam.flagUrl} name={match.awayTeam.name} size="sm" />
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="text-right text-sm shrink-0">
                      <p className={`font-medium text-xs ${match.status === 'FINISHED' ? 'text-gray-500' : match.status === 'LIVE' ? 'text-green-400' : 'text-gray-400'}`}>
                        {match.status === 'FINISHED' ? 'FT ✓' : match.status === 'LIVE' ? '🔴 LIVE' : dayjs(match.matchDate).format('D MMM HH:mm')}
                      </p>
                      <p className="text-xs text-gray-600">{match.stage.replace(/_/g,' ')}</p>
                    </div>
                  </div>

                  {/* Score entry panel */}
                  {editingId === match.id && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-3 flex-wrap"
                      onClick={e => e.stopPropagation()}>

                      {/* Home score */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">{match.homeTeam.code}</span>
                        <input type="number" min={0} max={30}
                          value={homeScore}
                          onChange={e => setHomeScore(e.target.value)}
                          className="w-16 text-center text-xl font-bold bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 focus:outline-none focus:border-primary-500 text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0" />
                      </div>

                      <span className="text-gray-600 font-bold text-lg">–</span>

                      {/* Away score */}
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} max={30}
                          value={awayScore}
                          onChange={e => setAwayScore(e.target.value)}
                          className="w-16 text-center text-xl font-bold bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 focus:outline-none focus:border-primary-500 text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0" />
                        <span className="text-sm text-gray-400">{match.awayTeam.code}</span>
                      </div>

                      <button onClick={handleEnterResult} disabled={savingResult} className="btn-primary ml-auto">
                        {savingResult ? 'Saving…' : match.status === 'FINISHED' ? 'Update Result' : 'Confirm Result'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SPECIAL RESULTS ──────────────────────────────────────────────── */}
      {tab === 'special' && (
        <div className="card space-y-4 max-w-md">
          <h2 className="font-semibold">Score Special Bets</h2>

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
              <TeamPicker
                teams={teams}
                value={specialTeamId}
                onChange={id => setSpecialTeamId(id)}
              />
            </div>
          ) : (
            <div>
              <label className="label">Player name</label>
              {players.length > 0 ? (
                <PlayerPicker
                  teams={teams}
                  players={players}
                  playerName={specialPlayer}
                  onSelect={setSpecialPlayer}
                />
              ) : (
                <input type="text" className="input" placeholder="Type player name…"
                  value={specialPlayer} onChange={e => setSpecialPlayer(e.target.value)} />
              )}
              <p className="text-xs text-gray-500 mt-1">
                Must match the player name users selected in their bets.
              </p>
            </div>
          )}

          <button onClick={handleScoreSpecial} disabled={savingSpecial} className="btn-primary w-full">
            {savingSpecial ? 'Scoring…' : 'Score Bets'}
          </button>
        </div>
      )}

      {/* ── USERS ────────────────────────────────────────────────────────── */}
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
                <p className="text-xs text-gray-600 mt-0.5">
                  {u._count.matchBets} match bets · {u._count.specialBets} special bets · joined {dayjs(u.createdAt).format('D MMM YYYY')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleResetPassword(u.id, u.username)}
                  disabled={resettingId === u.id}
                  className="btn-secondary text-xs py-1.5 px-3"
                  title="Reset password"
                >
                  {resettingId === u.id ? '…' : '🔑 Reset PW'}
                </button>
                <button onClick={() => handleDeleteUser(u.id, u.username)} className="btn-danger text-xs py-1.5 px-3">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LIVE SYNC ────────────────────────────────────────────────────── */}
      {tab === 'sync' && (
        <div className="space-y-4 max-w-xl">
          <div className="card space-y-3">
            <h2 className="font-semibold">Live Data Sync</h2>
            <p className="text-gray-400 text-sm">
              Pulls match schedule and results from <span className="text-white">football-data.org</span> (free tier — 10 req/min).
              The server polls every 5 minutes during the tournament.
            </p>

            {/* Last sync */}
            {syncStatus?.lastSync && (
              <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Last sync</span>
                  <span className="text-white">{dayjs(syncStatus.lastSync.syncedAt).format('D MMM HH:mm:ss')} ({dayjs(syncStatus.lastSync.syncedAt).fromNow()})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Matches updated</span>
                  <span className="text-white">{syncStatus.lastSync.matchesUpdated}</span>
                </div>
                {syncStatus.lastSync.error && (
                  <p className="text-yellow-400 text-xs mt-1">⚠️ {syncStatus.lastSync.error}</p>
                )}
              </div>
            )}

            {/* Sync buttons */}
            <div className="flex gap-2">
              <button onClick={() => handleSync('live')} disabled={syncing} className="btn-secondary flex-1 text-sm">
                {syncing ? '⏳ Syncing…' : '⚡ Quick sync'}
              </button>
              <button onClick={() => handleSync('full')} disabled={syncing} className="btn-primary flex-1 text-sm">
                {syncing ? '⏳ Syncing…' : '🔄 Full sync'}
              </button>
            </div>
          </div>

          {/* Player sync */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Player Squads</h2>
                <p className="text-gray-400 text-sm">
                  Sync all 48 squads (~1,200 players) for Special Bet player search. Uses 1 API call.
                </p>
              </div>
              <span className="text-sm text-gray-500">{players.length} players</span>
            </div>
            <button onClick={handleSyncPlayers} disabled={syncingPlayers} className="btn-secondary w-full text-sm">
              {syncingPlayers ? '⏳ Syncing players…' : '👥 Sync Players'}
            </button>
          </div>

          {/* Sync result */}
          {lastSyncResult && (
            <div className="card space-y-2 border-primary-700">
              <h3 className="font-medium text-primary-300">Sync result</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: 'Matches updated', value: lastSyncResult.matchesUpdated },
                  { label: 'Bets scored',     value: lastSyncResult.newlyScored },
                  { label: 'Teams linked',    value: lastSyncResult.teamsLinked },
                  { label: 'Errors',          value: lastSyncResult.errors.length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800 rounded px-3 py-2">
                    <p className="text-gray-400 text-xs">{label}</p>
                    <p className="text-white font-bold">{value}</p>
                  </div>
                ))}
              </div>
              {lastSyncResult.errors.length > 0 && (
                <div className="bg-red-950 border border-red-800 rounded p-2 text-xs text-red-300 space-y-1">
                  {lastSyncResult.errors.map((e, i) => <p key={i}>• {e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BACKUPS ──────────────────────────────────────────────────────── */}
      {tab === 'backup' && (
        <div className="space-y-4 max-w-xl">
          {/* Railway filesystem warning */}
          <div
            className="card flex gap-3 text-sm"
            style={{ borderLeft: '4px solid #F5A623', background: 'rgba(245,166,35,0.08)' }}
          >
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="font-semibold text-yellow-400">Backups are lost on every deploy</p>
              <p className="text-yellow-400/70 text-xs mt-1">
                Railway's container filesystem is wiped on each redeploy. Always{' '}
                <strong className="text-yellow-300">download the latest backup below before pushing new code</strong>.
                The database itself is safe — only these snapshot files are ephemeral.
              </p>
            </div>
          </div>

          <div className="card space-y-3">
            <div>
              <h2 className="font-semibold">Automatic Backups</h2>
              <p className="text-gray-400 text-sm mt-1">
                The server saves a full JSON snapshot of all bets, scores and user data every hour.
                Files are stored in <span className="text-white font-mono text-xs">server/backups/</span> on disk.
                The last 7 days (168 files) are kept automatically.
              </p>
            </div>
            <button onClick={handleBackup} disabled={backingUp} className="btn-primary w-full text-sm">
              {backingUp ? '⏳ Backing up…' : '💾 Backup now'}
            </button>
          </div>

          {/* Backup list */}
          <div className="card space-y-2">
            <h2 className="font-semibold">Recent Backups</h2>
            {backups.length === 0 ? (
              <p className="text-gray-500 text-sm">No backups yet — one will be created on next server start.</p>
            ) : (
              <div className="space-y-1">
                {backups.map((b, i) => (
                  <div key={b.filename} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-800 last:border-0">
                    <div className="min-w-0">
                      <p className={`font-mono text-xs truncate ${i === 0 ? 'text-green-400' : 'text-gray-300'}`}>
                        {i === 0 && <span className="mr-1">★</span>}{b.filename}
                      </p>
                      <p className="text-xs text-gray-500">{dayjs(b.createdAt).format('D MMM YYYY · HH:mm')} · {b.sizeKb} KB</p>
                    </div>
                    <button
                      onClick={() => adminService.downloadBackup(b.filename)}
                      className="ml-3 shrink-0 text-xs text-primary-400 hover:text-primary-300 border border-primary-700 hover:border-primary-500 px-2 py-1 rounded transition-colors"
                    >
                      ⬇ Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-2 bg-gray-900/50">
            <h3 className="font-medium text-sm">How to restore a backup</h3>
            <p className="text-xs text-gray-400">
              If something goes wrong, stop the server and run from the <span className="font-mono">server/</span> folder:
            </p>
            <pre className="text-xs bg-gray-800 rounded p-2 text-green-300 overflow-x-auto whitespace-pre-wrap">
              node restore-backup.mjs backups/backup_YYYY-MM-...json
            </pre>
            <p className="text-xs text-gray-500">
              This wipes the current database and restores all data from the chosen backup file.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
