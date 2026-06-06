import { useState, useRef, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { betService } from '../../services/betService';
import { useLang } from '../../i18n/LanguageContext';
import type { Match, MatchBet } from '../../types';

interface Props {
  match: Match;
  bet?: MatchBet;
  onBetSaved?: (bet: MatchBet) => void;
}

function Flag({ url, name }: { url?: string; name: string }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt={name}
      className="w-6 h-4 object-contain inline-block"
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

function clampScore(val: number) { return Math.max(0, Math.min(30, val)); }

/** Approximate in-game minute from kickoff time. */
function getLiveMinute(matchDate: string, htLabel: string): string {
  const elapsed = Math.floor((Date.now() - new Date(matchDate).getTime()) / 60_000);
  if (elapsed <= 0)  return 'LIVE';
  if (elapsed <= 45) return `${elapsed}'`;
  if (elapsed <= 60) return htLabel;
  const min2 = elapsed - 15;
  if (min2 <= 90)    return `${min2}'`;
  return `90+${min2 - 90}'`;
}

export default function MatchCard({ match, bet, onBetSaved }: Props) {
  const { t } = useLang();

  const stageLabel: Record<string, string> = {
    GROUP:         t.matchCard.groupStage,
    ROUND_OF_32:   t.matchCard.roundOf32,
    ROUND_OF_16:   t.matchCard.roundOf16,
    QUARTER_FINAL: t.matchCard.quarterFinal,
    SEMI_FINAL:    t.matchCard.semiFinal,
    THIRD_PLACE:   t.matchCard.thirdPlace,
    FINAL:         t.matchCard.final,
  };

  const isFinished = match.status === 'FINISHED';
  const isLive     = match.status === 'LIVE';
  const isUpcoming = match.status === 'UPCOMING';
  const bettingOpen = isUpcoming && new Date(match.matchDate).getTime() - Date.now() > 60_000;

  const [home, setHome] = useState<number>(bet?.predictedHome ?? 0);
  const [away, setAway] = useState<number>(bet?.predictedAway ?? 0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-render every 30 s while live to keep minute indicator current
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => forceUpdate(n => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [isLive]);

  const scheduleSave = useCallback((h: number, a: number) => {
    if (!bettingOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    debounceRef.current = setTimeout(async () => {
      try {
        const saved = await betService.placeMatchBet(match.id, h, a);
        setSaveState('saved');
        onBetSaved?.(saved);
        setTimeout(() => setSaveState('idle'), 1500);
      } catch {
        toast.error('Failed to save bet');
        setSaveState('idle');
      }
    }, 800);
  }, [match.id, isUpcoming, onBetSaved]);

  const changeHome = (val: number) => { setHome(val); scheduleSave(val, away); };
  const changeAway = (val: number) => { setAway(val); scheduleSave(home, val); };

  const betExact   = bet && isFinished && bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
  const betCorrect = bet && isFinished && !betExact && match.homeScore != null && match.awayScore != null &&
    (bet.predictedHome > bet.predictedAway ? 'home' : bet.predictedAway > bet.predictedHome ? 'away' : 'draw') ===
    (match.homeScore   > match.awayScore   ? 'home' : match.awayScore   > match.homeScore   ? 'away' : 'draw');

  const liveMinute = isLive ? getLiveMinute(match.matchDate, t.matchCard.ht) : null;

  // Status-based left border + glow
  const cardStyle: React.CSSProperties = {
    background: 'rgba(10, 20, 50, 0.70)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '14px',
    padding: '1rem',
    border: '1px solid rgba(60, 90, 200, 0.22)',
    borderLeft: isLive
      ? '4px solid #3CAC3B'
      : isFinished
        ? '4px solid rgba(42,57,141,0.5)'
        : '4px solid rgba(42,57,141,0.8)',
    boxShadow: isLive
      ? '0 8px 32px rgba(0,0,0,0.4), 0 0 24px rgba(60,172,59,0.25)'
      : '0 8px 24px rgba(0,0,0,0.35)',
  };

  return (
    <div style={cardStyle}>
      {/* Stage + date / live indicator */}
      <div className="flex justify-between items-center mb-3 text-xs text-gray-500">
        <span>{stageLabel[match.stage]}{match.groupRound ? ` · ${t.matchCard.md}${match.groupRound}` : ''}</span>
        {isLive ? (
          <span className="flex items-center gap-1 font-bold" style={{ color: '#3CAC3B' }}>
            <span className="animate-live-pulse">●</span>
            <span>{liveMinute}</span>
          </span>
        ) : isFinished ? (
          <span className="text-gray-500">{t.matchCard.ft}</span>
        ) : (
          <span className="text-gray-400">{dayjs(match.matchDate).format('D MMM · HH:mm')}</span>
        )}
      </div>

      {/* Teams + Score / Inputs */}
      <div className="flex items-center justify-between gap-2">
        {/* Home */}
        <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="font-semibold text-white text-sm truncate">{match.homeTeam.name}</span>
            <Flag url={match.homeTeam.flagUrl} name={match.homeTeam.name} />
          </div>
          <span className="text-xs text-gray-500">{match.homeTeam.code}</span>
        </div>

        {/* Centre */}
        <div className="flex items-center gap-1 shrink-0">
          {(isFinished || isLive) ? (
            <span
              className="text-2xl font-heading font-black tracking-wide px-2"
              style={{ color: isLive ? '#3CAC3B' : '#ffffff' }}
            >
              {match.homeScore} – {match.awayScore}
            </span>
          ) : !bettingOpen ? (
            <span className="text-gray-500 text-xl px-3">🔒</span>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <button
                  onClick={() => changeHome(clampScore(home + 1))}
                  className="w-8 h-7 text-xs rounded-t touch-manipulation transition-colors"
                  style={{ background: 'rgba(42,57,141,0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(42,57,141,0.8)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(42,57,141,0.5)')}
                >▲</button>
                <input
                  type="number" min={0} max={30}
                  value={home}
                  onChange={e => changeHome(clampScore(parseInt(e.target.value) || 0))}
                  className="w-10 h-9 text-center text-lg font-bold text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
                  style={{ background: 'rgba(10,20,55,0.9)', border: '1px solid rgba(42,57,141,0.5)', borderRadius: '4px' }}
                />
                <button
                  onClick={() => changeHome(clampScore(home - 1))}
                  className="w-8 h-7 text-xs rounded-b touch-manipulation transition-colors"
                  style={{ background: 'rgba(42,57,141,0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(42,57,141,0.8)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(42,57,141,0.5)')}
                >▼</button>
              </div>

              <span className="text-gray-600 font-bold text-lg mx-0.5">–</span>

              <div className="flex flex-col items-center">
                <button
                  onClick={() => changeAway(clampScore(away + 1))}
                  className="w-8 h-7 text-xs rounded-t touch-manipulation transition-colors"
                  style={{ background: 'rgba(42,57,141,0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(42,57,141,0.8)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(42,57,141,0.5)')}
                >▲</button>
                <input
                  type="number" min={0} max={30}
                  value={away}
                  onChange={e => changeAway(clampScore(parseInt(e.target.value) || 0))}
                  className="w-10 h-9 text-center text-lg font-bold text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
                  style={{ background: 'rgba(10,20,55,0.9)', border: '1px solid rgba(42,57,141,0.5)', borderRadius: '4px' }}
                />
                <button
                  onClick={() => changeAway(clampScore(away - 1))}
                  className="w-8 h-7 text-xs rounded-b touch-manipulation transition-colors"
                  style={{ background: 'rgba(42,57,141,0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(42,57,141,0.8)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(42,57,141,0.5)')}
                >▼</button>
              </div>
            </>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Flag url={match.awayTeam.flagUrl} name={match.awayTeam.name} />
            <span className="font-semibold text-white text-sm truncate">{match.awayTeam.name}</span>
          </div>
          <span className="text-xs text-gray-500">{match.awayTeam.code}</span>
        </div>
      </div>

      {/* Bottom status */}
      <div
        className="mt-3 pt-2 text-center text-xs min-h-[20px]"
        style={{ borderTop: '1px solid rgba(42,57,141,0.2)' }}
      >
        {bettingOpen && (
          saveState === 'saving' ? (
            <span className="text-gray-500">{t.matchCard.saving}</span>
          ) : saveState === 'saved' ? (
            <span style={{ color: '#3CAC3B' }}>{t.matchCard.saved}</span>
          ) : bet ? (
            <span className="text-gray-500">{t.matchCard.yourBet} <span className="text-white font-semibold">{bet.predictedHome} – {bet.predictedAway}</span></span>
          ) : (
            <span className="text-gray-600">{t.matchCard.enterPrediction}</span>
          )
        )}
        {isUpcoming && !bettingOpen && (
          <span className="text-gray-500">
            🔒 {t.matchCard.locked} · {bet
              ? <span className="text-white font-semibold">{bet.predictedHome} – {bet.predictedAway}</span>
              : t.matchCard.noBet}
          </span>
        )}
        {isFinished && bet && (
          <span className={betExact ? 'font-semibold' : ''} style={{ color: betExact ? '#F5A623' : betCorrect ? '#3CAC3B' : '#E61D25' }}>
            {t.matchCard.yourBet} {bet.predictedHome} – {bet.predictedAway}
            {' · '}
            {betExact ? t.matchCard.exact : betCorrect ? t.matchCard.correct : t.matchCard.wrong}
            {bet.pointsAwarded != null && bet.pointsAwarded > 0 && (
              <span className="ml-1 text-gray-400">(+{bet.pointsAwarded} {t.common.pts})</span>
            )}
          </span>
        )}
        {isFinished && !bet && <span className="text-gray-600">{t.matchCard.noBet}</span>}
        {isLive && bet && <span className="text-gray-400">{t.matchCard.yourBet} {bet.predictedHome} – {bet.predictedAway}</span>}
      </div>
    </div>
  );
}
