import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { leaderboardService } from '../services/leaderboardService';
import { useAuthStore } from '../store/authStore';
import type { LeaderboardEntry } from '../types';

const rankEmoji = (rank: number) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <span className="text-sm text-gray-400">{entries.length} participants</span>
      </div>

      {entries.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400">No results yet — scores will appear once matches are played.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isMe = entry.userId === user?.id;
            return (
              <div
                key={entry.userId}
                className={`card flex items-center gap-4 transition-all ${isMe ? 'border-primary-600 bg-primary-950/30' : ''}`}
              >
                {/* Rank */}
                <div className="w-12 text-center text-xl font-bold shrink-0">
                  {rankEmoji(entry.rank)}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate ${isMe ? 'text-primary-300' : 'text-white'}`}>
                    {entry.username}
                    {isMe && <span className="ml-2 text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-full">You</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ⭐ {entry.exactScores} exact · ✓ {entry.correctWinners} correct
                  </p>
                </div>

                {/* Points breakdown */}
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-white">{entry.totalPoints} <span className="text-sm text-gray-400">pts</span></p>
                  <p className="text-xs text-gray-500">
                    Match: {entry.matchPoints} · Special: {entry.specialPoints}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
