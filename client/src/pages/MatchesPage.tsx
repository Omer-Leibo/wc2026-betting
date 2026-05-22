import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { matchService } from '../services/matchService';
import { betService } from '../services/betService';
import MatchCard from '../components/matches/MatchCard';
import BetModal from '../components/bets/BetModal';
import type { Match, MatchBet } from '../types';

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [bets, setBets] = useState<MatchBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const [activeStage, setActiveStage] = useState<'GROUP' | 'KNOCKOUT'>('GROUP');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  useEffect(() => {
    Promise.all([matchService.getAll(), betService.getMyBets()])
      .then(([m, b]) => { setMatches(m); setBets(b.matchBets); })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const betByMatchId = Object.fromEntries(bets.map(b => [b.matchId, b]));
  const groupMatches = matches.filter(m => m.stage === 'GROUP' && m.homeTeam.group === selectedGroup);
  const knockoutMatches = matches.filter(m => m.stage !== 'GROUP');

  const handleBetSaved = (bet: MatchBet) => {
    setBets(prev => {
      const exists = prev.find(b => b.matchId === bet.matchId);
      return exists ? prev.map(b => b.matchId === bet.matchId ? bet : b) : [...prev, bet];
    });
    setSelectedMatch(null);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matches</h1>
        <p className="text-sm text-gray-400">{bets.length} bets placed</p>
      </div>

      {/* Stage selector */}
      <div className="flex gap-2">
        {(['GROUP', 'KNOCKOUT'] as const).map(s => (
          <button key={s} onClick={() => setActiveStage(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeStage === s ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {s === 'GROUP' ? 'Group Stage' : 'Knockout'}
          </button>
        ))}
      </div>

      {activeStage === 'GROUP' && (
        <>
          {/* Group tabs */}
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => (
              <button key={g} onClick={() => setSelectedGroup(g)}
                className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${selectedGroup === g ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {g}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-300">Group {selectedGroup}</h2>
            {groupMatches.length === 0 ? (
              <p className="text-gray-500">No matches for this group yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    bet={betByMatchId[match.id]}
                    onBetClick={setSelectedMatch}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeStage === 'KNOCKOUT' && (
        <div className="space-y-3">
          {knockoutMatches.length === 0 ? (
            <p className="text-gray-500">Knockout matches will appear after the group stage.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {knockoutMatches.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  bet={betByMatchId[match.id]}
                  onBetClick={setSelectedMatch}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bet modal */}
      {selectedMatch && (
        <BetModal
          match={selectedMatch}
          existingBet={betByMatchId[selectedMatch.id]}
          onClose={() => setSelectedMatch(null)}
          onSaved={handleBetSaved}
        />
      )}
    </div>
  );
}
