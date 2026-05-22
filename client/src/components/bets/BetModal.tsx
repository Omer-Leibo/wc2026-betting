import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { betService } from '../../services/betService';
import type { Match, MatchBet } from '../../types';

interface Props {
  match: Match;
  existingBet?: MatchBet;
  onClose: () => void;
  onSaved: (bet: MatchBet) => void;
}

export default function BetModal({ match, existingBet, onClose, onSaved }: Props) {
  const [home, setHome] = useState(existingBet?.predictedHome ?? 0);
  const [away, setAway] = useState(existingBet?.predictedAway ?? 0);
  const [loading, setLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const bet = await betService.placeMatchBet(match.id, home, away);
      toast.success('Bet saved!');
      onSaved(bet);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save bet');
    } finally {
      setLoading(false);
    }
  };

  const resultLabel = home > away
    ? match.homeTeam.name
    : away > home
    ? match.awayTeam.name
    : 'Draw';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="card w-full max-w-sm space-y-5" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Place your bet</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Teams */}
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-1">
            {match.stage === 'GROUP' ? `Group ${match.homeTeam.group} · Matchday ${match.groupRound}` : match.stage.replace('_', ' ')}
          </p>
          <p className="text-white font-semibold text-lg">
            {match.homeTeam.name} <span className="text-gray-500">vs</span> {match.awayTeam.name}
          </p>
        </div>

        {/* Score inputs */}
        <div className="flex items-center gap-4 justify-center">
          <div className="text-center flex-1">
            <p className="text-xs text-gray-400 mb-2">{match.homeTeam.code}</p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setHome(Math.max(0, home - 1))}
                className="w-8 h-8 bg-gray-800 rounded-lg text-lg font-bold hover:bg-gray-700 transition-colors">−</button>
              <span className="text-3xl font-bold w-8 text-center select-none">{home}</span>
              <button onClick={() => setHome(Math.min(30, home + 1))}
                className="w-8 h-8 bg-gray-800 rounded-lg text-lg font-bold hover:bg-gray-700 transition-colors">+</button>
            </div>
          </div>

          <span className="text-gray-600 font-bold text-xl">–</span>

          <div className="text-center flex-1">
            <p className="text-xs text-gray-400 mb-2">{match.awayTeam.code}</p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setAway(Math.max(0, away - 1))}
                className="w-8 h-8 bg-gray-800 rounded-lg text-lg font-bold hover:bg-gray-700 transition-colors">−</button>
              <span className="text-3xl font-bold w-8 text-center select-none">{away}</span>
              <button onClick={() => setAway(Math.min(30, away + 1))}
                className="w-8 h-8 bg-gray-800 rounded-lg text-lg font-bold hover:bg-gray-700 transition-colors">+</button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <p className="text-center text-sm text-gray-400">
          Predicted result: <span className="text-white font-medium">{resultLabel}</span>
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saving...' : existingBet ? 'Update Bet' : 'Place Bet'}
          </button>
        </div>
      </div>
    </div>
  );
}
