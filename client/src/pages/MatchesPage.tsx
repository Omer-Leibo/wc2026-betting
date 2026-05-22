import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { matchService } from '../services/matchService';
import MatchCard from '../components/matches/MatchCard';
import type { Match } from '../types';

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const [activeStage, setActiveStage] = useState<'GROUP' | 'KNOCKOUT'>('GROUP');

  useEffect(() => {
    matchService.getAll()
      .then(setMatches)
      .catch(() => toast.error('Failed to load matches'))
      .finally(() => setLoading(false));
  }, []);

  const groupMatches = matches.filter(m => m.stage === 'GROUP' && m.homeTeam.group === selectedGroup);
  const knockoutMatches = matches.filter(m => m.stage !== 'GROUP');

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Matches</h1>

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

          {/* Group matches */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-300">Group {selectedGroup}</h2>
            {groupMatches.length === 0 ? (
              <p className="text-gray-500">No matches found for this group.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupMatches.map(match => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeStage === 'KNOCKOUT' && (
        <div className="space-y-3">
          {knockoutMatches.length === 0 ? (
            <p className="text-gray-500">Knockout stage matches will appear once the group stage is complete.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {knockoutMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
