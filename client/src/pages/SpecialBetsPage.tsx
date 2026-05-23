import { useEffect, useState, FormEvent } from 'react';
import toast from 'react-hot-toast';
import { betService } from '../services/betService';
import { matchService } from '../services/matchService';
import type { SpecialBet, Team, Player } from '../types';

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

const BET_TYPES = [
  { type: 'CHAMPION'   as const, label: '🏆 Champion',   description: 'Which team will win the World Cup?',      points: 5 },
  { type: 'TOP_SCORER' as const, label: '⚽ Top Scorer', description: 'Who will be the top goal scorer?',        points: 4 },
  { type: 'TOP_ASSISTS' as const,label: '🎯 Top Assists', description: 'Who will have the most assists?',         points: 3 },
];

// ─── Searchable player picker ─────────────────────────────────────────────────

function PlayerPicker({
  players,
  value,
  onChange,
  placeholder,
}: {
  players: Player[];
  value: string;
  onChange: (name: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  const filtered = query.length < 1
    ? []
    : players.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 20);

  const handleSelect = (p: Player) => {
    onChange(p.name);
    setQuery(p.name);
    setOpen(false);
  };

  return (
    <div className="relative flex-1">
      <input
        type="text"
        className="input w-full"
        placeholder={placeholder}
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center justify-between"
              onMouseDown={() => handleSelect(p)}
            >
              <span className="text-white">{p.name}</span>
              <span className="text-xs text-gray-500 ml-2">
                {p.team?.name} · {p.position ?? '—'}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 1 && filtered.length === 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-500">
          No players found. Try a different name.
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SpecialBetsPage() {
  const [specialBets, setSpecialBets]   = useState<SpecialBet[]>([]);
  const [teams, setTeams]               = useState<Team[]>([]);
  const [players, setPlayers]           = useState<Player[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState<string | null>(null);

  const [championTeamId, setChampionTeamId] = useState<number | ''>('');
  const [topScorer, setTopScorer]           = useState('');
  const [topAssists, setTopAssists]         = useState('');

  useEffect(() => {
    Promise.all([
      betService.getMySpecialBets(),
      matchService.getTeams(),
      matchService.getPlayers(),
    ])
      .then(([bets, t, p]) => {
        setSpecialBets(bets);
        setTeams(t);
        setPlayers(p);
        const champion = bets.find(b => b.type === 'CHAMPION');
        const scorer   = bets.find(b => b.type === 'TOP_SCORER');
        const assists  = bets.find(b => b.type === 'TOP_ASSISTS');
        if (champion?.teamId)     setChampionTeamId(champion.teamId);
        if (scorer?.playerName)   setTopScorer(scorer.playerName);
        if (assists?.playerName)  setTopAssists(assists.playerName);
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
        if (!championTeamId) { toast.error('Please select a team'); setSaving(null); return; }
        bet = await betService.placeSpecialBet(type, { teamId: Number(championTeamId) });
      } else if (type === 'TOP_SCORER') {
        if (!topScorer.trim()) { toast.error('Please select a player'); setSaving(null); return; }
        bet = await betService.placeSpecialBet(type, { playerName: topScorer.trim() });
      } else {
        if (!topAssists.trim()) { toast.error('Please select a player'); setSaving(null); return; }
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

  const noPlayers = players.length === 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Special Bets</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Place your predictions for the tournament winners. These can be updated until the first match kicks off.
        </p>
      </div>

      {noPlayers && (
        <div className="card border-yellow-700 text-yellow-400 text-sm p-3">
          ⚠️ Player data not yet synced. Ask the admin to run <strong>Sync Players</strong> in the Admin panel.
        </div>
      )}

      {BET_TYPES.map(({ type, label, description, points }) => {
        const existing = existingBet(type);
        const isSaving = saving === type;
        const isPlayer = type === 'TOP_SCORER' || type === 'TOP_ASSISTS';

        return (
          <div key={type} className="card space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold">{label}</h2>
                <p className="text-gray-400 text-sm">{description}</p>
              </div>
              <span className="text-primary-400 font-bold text-sm shrink-0 ml-2">{points} pts</span>
            </div>

            {/* Current bet */}
            {existing && (
              <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-400">Current bet: </span>
                <span className="text-white font-medium">
                  {type === 'CHAMPION' ? existing.team?.name ?? '—' : existing.playerName ?? '—'}
                </span>
                {existing.pointsAwarded != null && (
                  <span className={`ml-2 font-bold ${existing.pointsAwarded > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {existing.pointsAwarded > 0 ? `+${existing.pointsAwarded} pts` : '✗'}
                  </span>
                )}
              </div>
            )}

            {/* Input form */}
            <form onSubmit={e => handleSave(e, type)} className="flex gap-2 items-start">
              {type === 'CHAMPION' ? (
                <select
                  className="input flex-1"
                  value={championTeamId}
                  onChange={e => setChampionTeamId(Number(e.target.value))}
                  required
                >
                  <option value="">Select a team…</option>
                  {GROUPS.map(g => (
                    <optgroup key={g} label={`Group ${g}`}>
                      {teams.filter(t => t.group === g).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <PlayerPicker
                  players={players}
                  value={type === 'TOP_SCORER' ? topScorer : topAssists}
                  onChange={v => type === 'TOP_SCORER' ? setTopScorer(v) : setTopAssists(v)}
                  placeholder={noPlayers ? 'Player data not synced yet…' : 'Search player name…'}
                />
              )}
              <button
                type="submit"
                className="btn-primary whitespace-nowrap"
                disabled={isSaving || (isPlayer && noPlayers)}
              >
                {isSaving ? 'Saving…' : existing ? 'Update' : 'Save'}
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
