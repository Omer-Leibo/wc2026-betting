import dayjs from 'dayjs';
import type { Match, MatchBet } from '../../types';

interface Props {
  match: Match;
  bet?: MatchBet;
  onBetClick?: (match: Match) => void;
}

const stageLabel: Record<string, string> = {
  GROUP: 'Group Stage',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINAL: 'Quarter Final',
  SEMI_FINAL: 'Semi Final',
  FINAL: 'Final',
};

const statusColors: Record<string, string> = {
  UPCOMING: 'text-gray-400',
  LIVE: 'text-green-400 animate-pulse',
  FINISHED: 'text-gray-500',
};

export default function MatchCard({ match, bet, onBetClick }: Props) {
  const isFinished = match.status === 'FINISHED';
  const isUpcoming = match.status === 'UPCOMING';

  const betCorrectWinner = bet && isFinished && match.homeScore !== undefined && match.awayScore !== undefined
    ? (() => {
        const actualWinner = match.homeScore > match.awayScore ? 'home' : match.awayScore > match.homeScore ? 'away' : 'draw';
        const predictedWinner = bet.predictedHome > bet.predictedAway ? 'home' : bet.predictedAway > bet.predictedHome ? 'away' : 'draw';
        return actualWinner === predictedWinner;
      })()
    : null;

  const betExactScore = bet && isFinished
    ? bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore
    : null;

  return (
    <div className={`card transition-all ${isUpcoming && onBetClick ? 'hover:border-primary-700 cursor-pointer' : ''}`}
      onClick={() => isUpcoming && onBetClick?.(match)}>

      {/* Stage + date */}
      <div className="flex justify-between items-center mb-3 text-xs">
        <span className="text-gray-500">{stageLabel[match.stage]}{match.groupRound ? ` · MD${match.groupRound}` : ''}</span>
        <span className={statusColors[match.status]}>
          {match.status === 'LIVE' ? '🔴 LIVE' : match.status === 'FINISHED' ? 'FT' : dayjs(match.matchDate).format('D MMM · HH:mm')}
        </span>
      </div>

      {/* Teams + Score */}
      <div className="flex items-center justify-between gap-3">
        {/* Home team */}
        <div className="flex-1 text-right">
          <p className="font-semibold text-white">{match.homeTeam.name}</p>
          <p className="text-xs text-gray-500">{match.homeTeam.code}</p>
        </div>

        {/* Score / VS */}
        <div className="flex items-center gap-2 min-w-[80px] justify-center">
          {isFinished || match.status === 'LIVE' ? (
            <span className="text-2xl font-bold text-white">
              {match.homeScore} – {match.awayScore}
            </span>
          ) : (
            <span className="text-gray-600 font-bold text-lg">vs</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 text-left">
          <p className="font-semibold text-white">{match.awayTeam.name}</p>
          <p className="text-xs text-gray-500">{match.awayTeam.code}</p>
        </div>
      </div>

      {/* Bet info */}
      {bet && (
        <div className={`mt-3 pt-3 border-t border-gray-800 text-center text-sm`}>
          <span className="text-gray-400">
            Your bet: <span className="text-white font-medium">{bet.predictedHome} – {bet.predictedAway}</span>
          </span>
          {isFinished && (
            <span className={`ml-3 font-semibold ${betExactScore ? 'text-yellow-400' : betCorrectWinner ? 'text-green-400' : 'text-red-400'}`}>
              {betExactScore ? '⭐ Exact!' : betCorrectWinner ? '✓ Correct' : '✗ Wrong'}
              {bet.pointsAwarded !== undefined && bet.pointsAwarded > 0 && (
                <span className="ml-1 text-gray-400">(+{bet.pointsAwarded} pts)</span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Place bet CTA */}
      {isUpcoming && !bet && onBetClick && (
        <div className="mt-3 pt-3 border-t border-gray-800 text-center">
          <span className="text-xs text-primary-400">Click to place bet</span>
        </div>
      )}
    </div>
  );
}
