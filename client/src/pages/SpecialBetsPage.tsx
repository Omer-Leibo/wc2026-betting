import { useEffect, useState, FormEvent } from 'react';
import toast from 'react-hot-toast';
import { betService } from '../services/betService';
import { matchService } from '../services/matchService';
import type { SpecialBet, Team } from '../types';

const BET_TYPES = [
  { type: 'CHAMPION' as const, label: '🏆 Champion', description: 'Which team will win the World Cup?', points: 5 },
  { type: 'TOP_SCORER' as const, label: '⚽ Top Scorer', description: 'Who will be the top goal scorer?', points: 4 },
  { type: 'TOP_ASSISTS' as const, label: '🎯 Top Assists', description: 'Who will have the most assists?', points: 3 },
];

export default function SpecialBetsPage() {
  const [specialBets, setSpecialBets] = useState<SpecialBet[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Form state
  const [championTeamId, setChampionTeamId] = useState<number | ''>('');
  const [topScorer, setTopScorer] = useState('');
  const [topAssists, setTopAssists] = useState('');

  useEffect(() => {
    Promise.all([betService.getMySpecialBets(), matchService.getTeams()])
      .then(([bets, t]) => {
        setSpecialBets(bets);
        setTeams(t);
        // Pre-fill existing bets
        const champion = bets.find(b => b.type === 'CHAMPION');
        const scorer = bets.find(b => b.type === 'TOP_SCORER');
        const assists = bets.find(b => b.type === 'TOP_ASSISTS');
        if (champion?.teamId) setChampionTeamId(champion.teamId);
        if (scorer?.playerName) setTopScorer(scorer.playerName);
        if (assists?.playerName) setTopAssists(assists.playerName);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const existingBet = (type: string) => specialBets.find(b => b.type === type);

  const handleSave = async (e: FormEvent, type: 'CHAMPION' | 'TOP_SCORER' | 'TOP_ASSISTS') => {
    e.preventDefault();
    setSaving(type);
    try {
      let bet: SpecialBet;
      if (type === 'CHAMPION') {
        if (!championTeamId) { toast.error('Please select a team'); return; }
        bet = await betService.placeSpecialBet(type, { teamId: Number(championTeamId) });
      } else if (type === 'TOP_SCORER') {
        if (!topScorer.trim()) { toast.error('Please enter a player name'); return; }
        bet = await betService.placeSpecialBet(type, { playerName: topScorer.trim() });
      } else {
        if (!topAssists.trim()) { toast.error('Please enter a player name'); return; }
        bet = await betService.placeSpecialBet(type, { playerName: topAssists.trim() });
      }
      setSpecialBets(prev => {
        const exists = prev.find(b => b.type === type);
        return exists ? prev.map(b => b.type === type ? bet : b) : [...prev, bet];
      });
      toast.success('Special bet saved!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Special Bets</h1>
        <p className="text-gray-400 mt-1 text-sm">Place your predictions for the tournament winners. These can be updated until the first match kicks off.</p>
      </div>

      {BET_TYPES.map(({ type, label, description, points }) => {
        const existing = existingBet(type);
        const isSaving = saving === type;

        return (
          <div key={type} className="card space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold">{label}</h2>
                <p className="text-gray-400 text-sm">{description}</p>
              </div>
              <span className="text-primary-400 font-bold text-sm">{points} pts</span>
            </div>

            {/* Current bet */}
            {existing && (
              <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-400">Current bet: </span>
                <span className="text-white font-medium">
                  {type === 'CHAMPION' ? existing.team?.name ?? '—' : existing.playerName ?? '—'}
                </span>
                {existing.pointsAwarded !== undefined && (
                  <span className={`ml-2 font-bold ${existing.pointsAwarded > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {existing.pointsAwarded > 0 ? `+${existing.pointsAwarded} pts` : '✗'}
                  </span>
                )}
              </div>
            )}

            {/* Input form */}
            <form onSubmit={e => handleSave(e, type)} className="flex gap-2">
              {type === 'CHAMPION' ? (
                <select
                  className="input"
                  value={championTeamId}
                  onChange={e => setChampionTeamId(Number(e.target.value))}
                  required
                >
                  <option value="">Select a team...</option>
                  {['A','B','C','D','E','F','G','H','I','J','K','L'].map(g => (
                    <optgroup key={g} label={`Group ${g}`}>
                      {teams.filter(t => t.group === g).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="input"
                  placeholder="Player name (e.g. Mbappé)"
                  value={type === 'TOP_SCORER' ? topScorer : topAssists}
                  onChange={e => type === 'TOP_SCORER' ? setTopScorer(e.target.value) : setTopAssists(e.target.value)}
                  required
                />
              )}
              <button type="submit" className="btn-primary whitespace-nowrap" disabled={isSaving}>
                {isSaving ? 'Saving...' : existing ? 'Update' : 'Save'}
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
