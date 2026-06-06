import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { leaderboardService } from '../services/leaderboardService';
import { useAuthStore } from '../store/authStore';
import type { LeaderboardEntry, SpecialBetDetail } from '../types';

const rankEmoji = (rank: number) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

function SpecialCell({ detail }: { detail: SpecialBetDetail | null }) {
  if (!detail) return <span className="text-gray-600 text-xs">—</span>;
  const awarded = detail.pointsAwarded;
  const color =
    awarded == null ? 'text-gray-300' :
    awarded > 0    ? 'text-green-400' :
                     'text-red-400';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {detail.name}
      {awarded != null && (
        <span className="ml-1 opacity-70">{awarded > 0 ? '✓' : '✗'}</span>
      )}
    </span>
  );
}

type Tab = 'rankings' | 'special';

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [entries, setEntries]       = useState<LeaderboardEntry[]>([]);
  const [hasLiveGames, setHasLive]  = useState(false);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<Tab>('rankings');

  const loadData = useCallback(async () => {
    const { entries: e, hasLiveGames: live } = await leaderboardService.get();
    setEntries(e);
    setHasLive(live);
  }, []);

  useEffect(() => {
    loadData()
      .catch(() => toast.error('Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, [loadData]);

  // Poll every 60 s while live games are happening
  useEffect(() => {
    if (!hasLiveGames) return;
    const timer = setInterval(() => loadData().catch(() => {}), 60_000);
    return () => clearInterval(timer);
  }, [hasLiveGames, loadData]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      tab === t ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
    }`;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          {hasLiveGames && (
            <span className="flex items-center gap-1.5 text-xs bg-green-900/40 border border-green-700 text-green-400 px-2.5 py-1 rounded-full font-medium">
              <span className="animate-pulse">🔴</span> Live
            </span>
          )}
        </div>
        <span className="text-sm text-gray-400">{entries.length} participants</span>
      </div>

      {hasLiveGames && (
        <p className="text-xs text-green-400/70">
          ⚡ Scores update every minute — provisional points shown for ongoing matches
        </p>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button className={tabClass('rankings')} onClick={() => setTab('rankings')}>
          📊 Rankings
        </button>
        <button className={tabClass('special')} onClick={() => setTab('special')}>
          ⭐ Special Bets
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400">No results yet — scores will appear once matches are played.</p>
        </div>
      ) : tab === 'rankings' ? (
        /* ── Rankings table ─────────────────────────────────────────────── */
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="px-3 py-3 text-left text-gray-400 font-medium w-10">#</th>
                <th className="px-3 py-3 text-left text-gray-400 font-medium">Player</th>
                <th className="px-3 py-3 text-center text-gray-400 font-medium" title="Correct result (not exact)">✓</th>
                <th className="px-3 py-3 text-center text-gray-400 font-medium" title="Exact scoreline">⭐</th>
                <th className="px-3 py-3 text-center text-gray-400 font-medium" title="Bonus points">🎯</th>
                <th className="px-3 py-3 text-center text-white font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isMe = entry.userId === user?.id;
                const liveTotal = entry.totalPoints + entry.provisionalPoints;
                const hasProvisional = hasLiveGames && entry.provisionalPoints > 0;

                return (
                  <tr
                    key={entry.userId}
                    className={`border-b border-gray-800 last:border-0 transition-colors ${
                      isMe ? 'bg-primary-950/40' : 'hover:bg-gray-800/40'
                    }`}
                  >
                    <td className="px-3 py-3 text-center font-bold text-base">
                      {rankEmoji(entry.rank)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`font-semibold ${isMe ? 'text-primary-300' : 'text-white'}`}>
                        {entry.username}
                      </span>
                      {isMe && (
                        <span className="ml-2 text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-green-400 font-medium">{entry.correctScores}</td>
                    <td className="px-3 py-3 text-center text-yellow-400 font-medium">{entry.exactScores}</td>
                    <td className="px-3 py-3 text-center text-purple-400 font-medium">
                      {entry.bonusPoints > 0 ? `+${entry.bonusPoints}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {hasProvisional ? (
                        <span className="flex flex-col items-center leading-tight">
                          <span className="text-lg font-bold text-white">{liveTotal}</span>
                          <span className="text-[10px] text-green-400/70">+{entry.provisionalPoints} live</span>
                        </span>
                      ) : (
                        <span className="text-lg font-bold text-white">{entry.totalPoints}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Special bets table ──────────────────────────────────────────── */
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="px-3 py-3 text-left text-gray-400 font-medium">Player</th>
                <th className="px-3 py-3 text-center text-gray-400 font-medium">🏆 Champion</th>
                <th className="px-3 py-3 text-center text-gray-400 font-medium">⚽ Top Scorer</th>
                <th className="px-3 py-3 text-center text-gray-400 font-medium">🎯 Top Assists</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isMe = entry.userId === user?.id;
                return (
                  <tr
                    key={entry.userId}
                    className={`border-b border-gray-800 last:border-0 transition-colors ${
                      isMe ? 'bg-primary-950/40' : 'hover:bg-gray-800/40'
                    }`}
                  >
                    <td className="px-3 py-3">
                      <span className={`font-semibold text-sm ${isMe ? 'text-primary-300' : 'text-white'}`}>
                        {entry.username}
                      </span>
                      {isMe && (
                        <span className="ml-2 text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <SpecialCell detail={entry.specialBetDetails?.champion ?? null} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <SpecialCell detail={entry.specialBetDetails?.topScorer ?? null} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <SpecialCell detail={entry.specialBetDetails?.topAssists ?? null} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span><span className="text-green-400">✓</span> Correct result</span>
        <span><span className="text-yellow-400">⭐</span> Exact scoreline</span>
        <span><span className="text-purple-400">🎯</span> Group stage bonus</span>
        {hasLiveGames && <span><span className="text-green-400/70">+X live</span> Provisional points from ongoing matches</span>}
        <span><span className="text-green-400">✓</span>/<span className="text-red-400">✗</span> on special bets — shown once results announced</span>
      </div>
    </div>
  );
}
