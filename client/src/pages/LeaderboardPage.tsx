import { useEffect, useState } from 'react';
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
  if (!detail) return <span className="text-gray-600">—</span>;
  const awarded = detail.pointsAwarded;
  const color =
    awarded == null ? 'text-gray-300' :   // not yet scored
    awarded > 0    ? 'text-green-400' :   // correct
                     'text-red-400';      // wrong
  return (
    <span className={`text-xs font-medium ${color}`} title={awarded != null ? (awarded > 0 ? `+${awarded} pts` : 'Wrong') : 'Pending'}>
      {detail.name}
      {awarded != null && (
        <span className="ml-1 opacity-70">{awarded > 0 ? '✓' : '✗'}</span>
      )}
    </span>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaderboardService.get()
      .then(setEntries)
      .catch(() => toast.error('Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <span className="text-sm text-gray-400">{entries.length} participants</span>
      </div>

      {entries.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400">No results yet — scores will appear once matches are played.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="px-4 py-3 text-left text-gray-400 font-medium w-12">#</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Player</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium" title="Correct winner (not exact)">✓ Correct</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium" title="Exact scoreline">⭐ Exact</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium" title="Bonus points from ladders">🎯 Bonus</th>
                <th className="px-4 py-3 text-center text-white font-semibold">Total Pts</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium border-l border-gray-800">🏆 Champion</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">⚽ Top Scorer</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">🎯 Top Assists</th>
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
                    {/* Rank */}
                    <td className="px-4 py-3 text-center font-bold text-lg">
                      {rankEmoji(entry.rank)}
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${isMe ? 'text-primary-300' : 'text-white'}`}>
                        {entry.username}
                      </span>
                      {isMe && (
                        <span className="ml-2 text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </td>

                    {/* Correct (winner only, not exact) */}
                    <td className="px-4 py-3 text-center text-green-400 font-medium">
                      {entry.correctScores}
                    </td>

                    {/* Exact */}
                    <td className="px-4 py-3 text-center text-yellow-400 font-medium">
                      {entry.exactScores}
                    </td>

                    {/* Bonus */}
                    <td className="px-4 py-3 text-center text-purple-400 font-medium">
                      {entry.bonusPoints > 0 ? `+${entry.bonusPoints}` : '—'}
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-xl font-bold text-white">{entry.totalPoints}</span>
                      <span className="text-xs text-gray-500 ml-1">pts</span>
                    </td>

                    {/* Champion */}
                    <td className="px-4 py-3 text-center border-l border-gray-800">
                      <SpecialCell detail={entry.specialBetDetails?.champion ?? null} />
                    </td>

                    {/* Top Scorer */}
                    <td className="px-4 py-3 text-center">
                      <SpecialCell detail={entry.specialBetDetails?.topScorer ?? null} />
                    </td>

                    {/* Top Assists */}
                    <td className="px-4 py-3 text-center">
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
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span><span className="text-green-400">✓ Correct</span> — right result / winner</span>
        <span><span className="text-yellow-400">⭐ Exact</span> — exact scoreline</span>
        <span><span className="text-purple-400">🎯 Bonus</span> — group stage accuracy &amp; exact ladders</span>
        <span><span className="text-green-400">✓</span> / <span className="text-red-400">✗</span> on special bets — shown once results are announced</span>
      </div>
    </div>
  );
}
