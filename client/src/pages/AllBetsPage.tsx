import { useEffect, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { betService } from '../services/betService';
import { useAuthStore } from '../store/authStore';
import { useLang } from '../i18n/LanguageContext';
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

/** Approximate in-game minute from kickoff time */
function getLiveMinute(matchDate: string, htLabel: string): string {
  const kickoff = new Date(matchDate).getTime();
  const elapsed = Math.floor((Date.now() - kickoff) / 60_000);
  if (elapsed <= 0)  return 'LIVE';
  if (elapsed <= 45) return `${elapsed}'`;
  if (elapsed <= 60) return htLabel;
  const min2 = elapsed - 15;
  if (min2 <= 90)    return `${min2}'`;
  return `90+${min2 - 90}'`;
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
  const { t } = useLang();
  const isFinished = match.status === 'FINISHED';
  const isLive     = match.status === 'LIVE';
  const hasScore   = match.homeScore != null && match.awayScore != null;
  const actualWinner = hasScore ? getWinner(match.homeScore!, match.awayScore!) : null;

  // Tick every 30 s while live to keep the minute fresh
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => forceUpdate(n => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [isLive]);

  const liveMinute = isLive ? getLiveMinute(match.matchDate, t.matchCard.ht) : null;

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
              {dayjs(match.matchDate).format('D MMM · HH:mm')}
            </span>
          )}
          <div className="text-[10px] mt-0.5">
            {isFinished ? (
              <span className="text-gray-600">{t.matchCard.ft}</span>
            ) : isLive ? (
              <span className="flex items-center justify-center gap-1 text-green-400 font-semibold">
                <span className="animate-pulse">🔴</span>
                <span>{liveMinute}</span>
              </span>
            ) : (
              <span className="text-gray-600">{t.matchCard.locked}</span>
            )}
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
        <p className="text-xs text-gray-600 text-center">{t.allBets.noBet}</p>
      ) : (
        <div className="border-t border-gray-800 pt-2 space-y-1">
          {match.bets.map(bet => {
            const isMe = bet.userId === myUserId;
            let resultLabel: React.ReactNode = null;

            if (isFinished && hasScore) {
              const isExact = bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
              const correctWin = !isExact && getWinner(bet.predictedHome, bet.predictedAway) === actualWinner;
              if (isExact) {
                resultLabel = <span className="text-yellow-400">⭐ {t.matchCard.exact}{bet.pointsAwarded ? ` +${bet.pointsAwarded}` : ''}</span>;
              } else if (correctWin) {
                resultLabel = <span className="text-green-400">✓ {t.matchCard.correct}{bet.pointsAwarded ? ` +${bet.pointsAwarded}` : ''}</span>;
              } else {
                resultLabel = <span className="text-red-400">✗ {t.matchCard.wrong}</span>;
              }
            }

            // Provisional result indicator during live games (dimmed to show it's not final)
            if (isLive && hasScore) {
              const isExact = bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
              const correctWin = !isExact && getWinner(bet.predictedHome, bet.predictedAway) === actualWinner;
              if (isExact) {
                resultLabel = <span className="text-yellow-300 opacity-60">⭐ {t.allBets.exact}</span>;
              } else if (correctWin) {
                resultLabel = <span className="text-green-300 opacity-60">✓ {t.allBets.winning}</span>;
              } else {
                resultLabel = <span className="text-red-300 opacity-60">✗ {t.allBets.losing}</span>;
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
                  {bet.username}{isMe && <span className="ml-1 text-[10px] text-primary-400">({t.leaderboard.you})</span>}
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
  const { t } = useLang();
  const [matches, setMatches] = useState<MatchWithAllBets[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    return betService.getAllBets().then(setMatches).catch(() => toast.error('Failed to load bets'));
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Auto-refresh every 60 s while live games are happening
  useEffect(() => {
    const hasLive = matches.some(m => m.status === 'LIVE');
    if (!hasLive) return;
    const timer = setInterval(loadData, 60_000);
    return () => clearInterval(timer);
  }, [matches, loadData]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Translated knockout labels (reactive to language)
  const KNOCKOUT_LABELS: Record<string, string> = {
    ROUND_OF_32:   t.matches.roundOf32,
    ROUND_OF_16:   t.matches.roundOf16,
    QUARTER_FINAL: t.matches.quarterFinal,
    SEMI_FINAL:    t.matches.semiFinal,
    THIRD_PLACE:   t.matches.thirdPlace,
    FINAL:         t.matches.final,
  };

  function getSectionLabel(key: string): string {
    if (key.startsWith('GROUP_')) {
      const md = key.replace('GROUP_', '');
      return `🟢 ${t.matches.matchday} ${md}`;
    }
    return KNOCKOUT_LABELS[key] ?? key;
  }

  // Build sections dynamically — handles any matchday number
  const groupKeys = [...new Set(matches.filter(m => m.stage === 'GROUP').map(sectionKey))]
    .sort((a, b) => (parseInt(a.replace('GROUP_', '')) || 0) - (parseInt(b.replace('GROUP_', '')) || 0));
  const knockoutKeys = KNOCKOUT_SECTION_ORDER.filter(k => matches.some(m => sectionKey(m) === k));
  // Reverse so the most-recent stage (and newest games within it) appear first —
  // live matches naturally rise to the top.
  const dynamicOrder = [...groupKeys, ...knockoutKeys].reverse();

  const sections: { key: string; label: string; matches: MatchWithAllBets[] }[] = [];
  for (const key of dynamicOrder) {
    const sMatches = matches
      .filter(m => sectionKey(m) === key)
      .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
    if (sMatches.length > 0) {
      sections.push({ key, label: getSectionLabel(key), matches: sMatches });
    }
  }

  const hasLive = matches.some(m => m.status === 'LIVE');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{t.allBets.title}</h1>
          {hasLive && (
            <span className="flex items-center gap-1.5 text-xs bg-green-900/40 border border-green-700 text-green-400 px-2.5 py-1 rounded-full font-medium">
              <span className="animate-pulse">🔴</span> {t.allBets.live}
            </span>
          )}
        </div>
        <p className="text-gray-400 mt-1 text-sm">
          {/* Keep English for now — complex descriptive text */}
          Everyone's predictions — visible once betting closes for each match (1 minute before kick-off).
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400">{t.allBets.noMatches}</p>
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
