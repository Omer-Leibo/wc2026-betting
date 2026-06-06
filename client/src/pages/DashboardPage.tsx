import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { betService } from '../services/betService';
import { leaderboardService } from '../services/leaderboardService';
import { useAuthStore } from '../store/authStore';
import type { MatchBet, SpecialBet, LeaderboardEntry } from '../types';
import dayjs from 'dayjs';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card text-center">
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [matchBets, setMatchBets] = useState<MatchBet[]>([]);
  const [specialBets, setSpecialBets] = useState<SpecialBet[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([betService.getMyBets(), leaderboardService.get()])
      .then(([bets, lb]) => {
        setMatchBets(bets.matchBets);
        setSpecialBets(bets.specialBets);
        setLeaderboard(lb.entries);
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const myEntry = leaderboard.find(e => e.userId === user?.id);
  const finishedBets = matchBets.filter(b => b.match?.status === 'FINISHED');
  const upcomingBets = matchBets.filter(b => b.match?.status === 'UPCOMING');

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user?.username}! ⚽</h1>
        <p className="text-gray-400 mt-1 text-sm">FIFA World Cup 2026 · June–July 2026</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Points"
          value={myEntry?.totalPoints ?? 0}
          sub={myEntry ? `Rank #${myEntry.rank} of ${leaderboard.length}` : 'No results yet'}
        />
        <StatCard label="Match Bets" value={matchBets.length} sub="placed" />
        <StatCard label="Exact Scores" value={myEntry?.exactScores ?? 0} sub="all time" />
        <StatCard label="Correct Winners" value={myEntry?.correctScores ?? 0} sub="all time" />
      </div>

      {/* Special bets status */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Special Bets</h2>
          <Link to="/special-bets" className="text-xs text-primary-400 hover:text-primary-300">Edit →</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '🏆 Champion', type: 'CHAMPION' as const },
            { label: '⚽ Top Scorer', type: 'TOP_SCORER' as const },
            { label: '🎯 Top Assists', type: 'TOP_ASSISTS' as const },
          ].map(({ label, type }) => {
            const bet = specialBets.find(b => b.type === type);
            return (
              <div key={type} className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-sm font-medium ${bet ? 'text-white' : 'text-gray-600'}`}>
                  {bet
                    ? type === 'CHAMPION' ? (bet.team?.name ?? '—') : (bet.playerName ?? '—')
                    : 'Not placed'}
                </p>
                {bet?.pointsAwarded !== undefined && (
                  <p className={`text-xs mt-1 font-bold ${bet.pointsAwarded > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bet.pointsAwarded > 0 ? `+${bet.pointsAwarded} pts` : '✗'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Recent results */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Recent Results</h2>
            <Link to="/matches" className="text-xs text-primary-400 hover:text-primary-300">All matches →</Link>
          </div>
          {finishedBets.length === 0 ? (
            <p className="text-gray-500 text-sm">No finished matches yet.</p>
          ) : (
            <div className="space-y-2">
              {finishedBets.slice(-5).reverse().map(bet => {
                const m = bet.match!;
                const isExact = bet.predictedHome === m.homeScore && bet.predictedAway === m.awayScore;
                return (
                  <div key={bet.id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300 truncate flex-1">
                      {m.homeTeam?.code} {m.homeScore}–{m.awayScore} {m.awayTeam?.code}
                    </span>
                    <span className={`ml-2 font-medium shrink-0 ${isExact ? 'text-yellow-400' : (bet.pointsAwarded ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {isExact ? '⭐' : (bet.pointsAwarded ?? 0) > 0 ? '✓' : '✗'} +{bet.pointsAwarded ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming bets */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Upcoming Bets</h2>
            <Link to="/matches" className="text-xs text-primary-400 hover:text-primary-300">Place bets →</Link>
          </div>
          {upcomingBets.length === 0 ? (
            <p className="text-gray-500 text-sm">No upcoming bets yet — go place some!</p>
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
                <p className="text-xs text-gray-600">+{upcomingBets.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
