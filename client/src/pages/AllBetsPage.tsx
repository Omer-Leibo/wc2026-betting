import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { betService } from '../services/betService';
import { useAuthStore } from '../store/authStore';
import type { MatchWithAllBets } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Winner = 'home' | 'away' | 'draw';
function getWinner(h: number, a: number): Winner {
  return h > a ? 'home' : a > h ? 'away' : 'draw';
}

function sectionKey(match: MatchWithAllBets): string {
  if (match.stage === 'GROUP') return `GROUP_${match.groupRound ?? 1}`;
  return match.stage;
}

const KNOCKOUT_SECTION_ORDER = [
  'ROUND_OF_32','ROUND_OF_16','QUARTER_FINAL','SEMI_FINAL','THIRD_PLACE','FINAL',
];

const KNOCKOUT_LABELS: Record<string, string> = {
  ROUND_OF_32:   '🔵 Round of 32',
  ROUND_OF_16:   '🔵 Round of 16',
  QUARTER_FINAL: '🟡 Quarter-finals',
  SEMI_FINAL:    '🟠 Semi-finals',
  THIRD_PLACE:   '⚪ 3rd Place Final',
  FINAL:         '🏆 Final',
};

function getSectionLabel(key: string): string {
  if (key.startsWith('GROUP_')) {
    const md = key.replace('GROUP_', '');
    return `🟢 Matchday ${md}`;
  }
  return KNOCKOUT_LABELS[key] ?? key;
}

function Flag({ url, name }: { url?: string; name: string }) {
  if (!url) return null;
  return (
    <img src={url} alt={name} className="w-5 h-3.5 object-contain inline-block"
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
  );
}

// ─── Match block ──────────────────────────────────────────────────────────────

function MatchBlock({ match, myUserId }: { match: MatchWithAllBets; myUserId?: number }) {
  const isFinished = match.status === 'FINISHED';
  const isLive     = match.status === 'LIVE';
  const hasScore   = match.homeScore != null && match.awayScore != null;
  const actualWinner = hasScore ? getWinner(match.homeScore!, match.awayScore!) : null;

  return (
    <div className="card space-y-3">
      {/* Match header */}
      <div className="flex items-center justify-between gap-2">
        {/* Home team */}
        <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
          <span className="font-semibold text-white text-sm truncate">{match.homeTeam.name}</span>
          <Flag url={match.homeTeam.flagUrl} name={match.homeTeam.name} />
        </div>

        {/* Score / time */}
        <div className="shrink-0 text-center px-2">
          {isFinished || (isLive && hasScore) ? (
            <span className="text-xl font-bold text-white">
              {match.homeScore} – {match.awayScore}
            </span>
          ) : (
            <span className="text-sm text-gray-400">
              {isLive ? '🔴 LIVE' : dayjs(match.matchDate).format('D MMM · HH:mm')}
            </span>
          )}
          <div className="text-[10px] text-gray-600 mt-0.5">
            {isFinished ? 'FT' : isLive ? '' : 'Locked'}
          </div>
        </div>

        {/* Away team */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <Flag url={match.awayTeam.flagUrl} name={match.awayTeam.name} />
          <span className="font-semibold text-white text-sm truncate">{match.awayTeam.name}</span>
        </div>
      </div>

      {/* Bets list */}
      {match.bets.length === 0 ? (
        <p className="text-xs text-gray-600 text-center">No bets placed for this match</p>
      ) : (
        <div className="border-t border-gray-800 pt-2 space-y-1">
          {match.bets.map(bet => {
            const isMe = bet.userId === myUserId;
            let resultLabel: React.ReactNode = null;

            if (isFinished && hasScore) {
              const isExact = bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
              const correctWin = !isExact && getWinner(bet.predictedHome, bet.predictedAway) === actualWinner;
              if (isExact) {
                resultLabel = <span className="text-yellow-400">⭐ Exact{bet.pointsAwarded ? ` +${bet.pointsAwarded}` : ''}</span>;
              } else if (correctWin) {
                resultLabel = <span className="text-green-400">✓ Correct{bet.pointsAwarded ? ` +${bet.pointsAwarded}` : ''}</span>;
              } else {
                resultLabel = <span className="text-red-400">✗ Wrong</span>;
              }
            }

            return (
              <div
                key={bet.userId}
                className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                  isMe ? 'bg-primary-900/40' : ''
                }`}
              >
                <span className={`font-medium ${isMe ? 'text-primary-300' : 'text-gray-300'}`}>
                  {bet.username}{isMe && <span className="ml-1 text-[10px] text-primary-400">(you)</span>}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold tabular-nums">
                    {bet.predictedHome} – {bet.predictedAway}
                  </span>
                  {resultLabel && <span className="text-right min-w-[80px]">{resultLabel}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AllBetsPage() {
  const { user } = useAuthStore();
  const [matches, setMatches] = useState<MatchWithAllBets[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    betService.getAllBets()
      .then(setMatches)
      .catch(() => toast.error('Failed to load bets'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Build sections dynamically — handles any matchday number
  const groupKeys = [...new Set(matches.filter(m => m.stage === 'GROUP').map(sectionKey))]
    .sort((a, b) => (parseInt(a.replace('GROUP_', '')) || 0) - (parseInt(b.replace('GROUP_', '')) || 0));
  const knockoutKeys = KNOCKOUT_SECTION_ORDER.filter(k => matches.some(m => sectionKey(m) === k));
  const dynamicOrder = [...groupKeys, ...knockoutKeys];

  const sections: { key: string; label: string; matches: MatchWithAllBets[] }[] = [];
  for (const key of dynamicOrder) {
    const sMatches = matches.filter(m => sectionKey(m) === key);
    if (sMatches.length > 0) {
      sections.push({ key, label: getSectionLabel(key), matches: sMatches });
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">All Bets</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Everyone's predictions — visible once betting closes for each match (1 minute before kick-off).
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400">No closed matches yet — check back once the first game is about to kick off.</p>
        </div>
      ) : (
        sections.map(({ key, label, matches: sMatches }) => (
          <div key={key} className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider border-b border-gray-800 pb-2">
              {label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {sMatches.map(match => (
                <MatchBlock key={match.id} match={match} myUserId={user?.id} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
