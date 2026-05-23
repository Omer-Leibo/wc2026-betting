import { useState, useRef, useCallback } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { betService } from '../../services/betService';
import type { Match, MatchBet } from '../../types';

interface Props {
  match: Match;
  bet?: MatchBet;
  onBetSaved?: (bet: MatchBet) => void;
}

const stageLabel: Record<string, string> = {
  GROUP:         'Group Stage',
  ROUND_OF_32:   'Round of 32',
  ROUND_OF_16:   'Round of 16',
  QUARTER_FINAL: 'Quarter Final',
  SEMI_FINAL:    'Semi Final',
  THIRD_PLACE:   '3rd Place',
  FINAL:         'Final',
};

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

export default function MatchCard({ match, bet, onBetSaved }: Props) {
  const isFinished = match.status === 'FINISHED';
  const isLive     = match.status === 'LIVE';
  const isUpcoming = match.status === 'UPCOMING';

  const [home, setHome] = useState<number>(bet?.predictedHome ?? 0);
  const [away, setAway] = useState<number>(bet?.predictedAway ?? 0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with 800ms debounce
  const scheduleSave = useCallback((h: number, a: number) => {
    if (!isUpcoming) return;
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

  // Result badge for finished matches
  const betExact    = bet && isFinished && bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
  const betCorrect  = bet && isFinished && !betExact && match.homeScore != null && match.awayScore != null &&
    (bet.predictedHome > bet.predictedAway ? 'home' : bet.predictedAway > bet.predictedHome ? 'away' : 'draw') ===
    (match.homeScore   > match.awayScore   ? 'home' : match.awayScore   > match.homeScore   ? 'away' : 'draw');

  return (
    <div className="card">
      {/* Stage + date row */}
      <div className="flex justify-between items-center mb-3 text-xs text-gray-500">
        <span>{stageLabel[match.stage]}{match.groupRound ? ` · MD${match.groupRound}` : ''}</span>
        <span className={isLive ? 'text-green-400 font-semibold animate-pulse' : isFinished ? 'text-gray-500' : 'text-gray-400'}>
          {isLive ? '🔴 LIVE' : isFinished ? 'FT' : dayjs(match.matchDate).format('D MMM · HH:mm')}
        </span>
      </div>

      {/* Teams + Score / Bet inputs */}
      <div className="flex items-center justify-between gap-2">
        {/* Home */}
        <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="font-semibold text-white text-sm truncate">{match.homeTeam.name}</span>
            <Flag url={match.homeTeam.flagUrl} name={match.homeTeam.name} />
          </div>
          <span className="text-xs text-gray-500">{match.homeTeam.code}</span>
        </div>

        {/* Centre: actual score (finished/live) or bet inputs (upcoming) */}
        <div className="flex items-center gap-1 shrink-0">
          {(isFinished || isLive) ? (
            <span className="text-2xl font-bold text-white px-2">
              {match.homeScore} – {match.awayScore}
            </span>
          ) : (
            <>
              {/* Home score input */}
              <div className="flex flex-col items-center">
                <button onClick={() => changeHome(clampScore(home + 1))}
                  className="w-6 h-5 text-xs bg-gray-700 rounded-t hover:bg-gray-600 leading-none">▲</button>
                <input
                  type="number" min={0} max={30}
                  value={home}
                  onChange={e => changeHome(clampScore(parseInt(e.target.value) || 0))}
                  className="w-10 h-8 text-center text-lg font-bold bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-primary-500 text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button onClick={() => changeHome(clampScore(home - 1))}
                  className="w-6 h-5 text-xs bg-gray-700 rounded-b hover:bg-gray-600 leading-none">▼</button>
              </div>

              <span className="text-gray-600 font-bold text-lg mx-0.5">–</span>

              {/* Away score input */}
              <div className="flex flex-col items-center">
                <button onClick={() => changeAway(clampScore(away + 1))}
                  className="w-6 h-5 text-xs bg-gray-700 rounded-t hover:bg-gray-600 leading-none">▲</button>
                <input
                  type="number" min={0} max={30}
                  value={away}
                  onChange={e => changeAway(clampScore(parseInt(e.target.value) || 0))}
                  className="w-10 h-8 text-center text-lg font-bold bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-primary-500 text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button onClick={() => changeAway(clampScore(away - 1))}
                  className="w-6 h-5 text-xs bg-gray-700 rounded-b hover:bg-gray-600 leading-none">▼</button>
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

      {/* Bottom row: save state OR bet result */}
      <div className="mt-3 pt-2 border-t border-gray-800 text-center text-xs min-h-[20px]">
        {isUpcoming && (
          saveState === 'saving' ? (
            <span className="text-gray-500">Saving…</span>
          ) : saveState === 'saved' ? (
            <span className="text-green-400">✓ Saved</span>
          ) : bet ? (
            <span className="text-gray-500">Your bet: <span className="text-white">{bet.predictedHome} – {bet.predictedAway}</span></span>
          ) : (
            <span className="text-gray-600">Enter your prediction above</span>
          )
        )}
        {isFinished && bet && (
          <span className={betExact ? 'text-yellow-400 font-semibold' : betCorrect ? 'text-green-400' : 'text-red-400'}>
            Your bet: {bet.predictedHome} – {bet.predictedAway}
            {' · '}
            {betExact ? '⭐ Exact!' : betCorrect ? '✓ Correct' : '✗ Wrong'}
            {bet.pointsAwarded != null && bet.pointsAwarded > 0 && (
              <span className="ml-1 text-gray-400">(+{bet.pointsAwarded} pts)</span>
            )}
          </span>
        )}
        {isFinished && !bet && (
          <span className="text-gray-600">No bet placed</span>
        )}
        {isLive && bet && (
          <span className="text-gray-400">Your bet: {bet.predictedHome} – {bet.predictedAway}</span>
        )}
      </div>
    </div>
  );
}
