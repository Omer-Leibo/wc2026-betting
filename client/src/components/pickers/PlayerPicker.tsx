import { useEffect, useState, useRef } from 'react';
import { Flag } from '../Flag';
import { TeamPicker } from './TeamPicker';
import { useLang } from '../../i18n/LanguageContext';
import type { Team, Player } from '../../types';

export function PlayerPicker({
  teams, players, playerName, onSelect, locked,
}: {
  teams: Team[];
  players: Player[];
  playerName: string;
  onSelect: (playerName: string) => void;
  locked?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const [teamId, setTeamId] = useState<number | ''>('');
  const ref = useRef<HTMLDivElement>(null);

  const selectedPlayer = players.find(p => p.name === playerName);
  const selectedTeam   = teams.find(tm => tm.id === selectedPlayer?.teamId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = players.filter(p => {
    const matchesSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
    const matchesTeam   = teamId === '' || p.teamId === teamId;
    return matchesSearch && matchesTeam;
  }).slice(0, 60);

  const handleSelect = (p: Player) => { onSelect(p.name); setOpen(false); };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect('');
    setSearch('');
    setTeamId('');
  };

  return (
    <div ref={ref} className="relative flex-1">
      {/* Trigger */}
      <div
        role="button"
        onClick={() => !locked && setOpen(o => !o)}
        className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors select-none"
        style={{
          background: 'rgba(10,20,55,0.85)',
          border: open ? '1px solid rgba(60,90,200,0.6)' : '1px solid rgba(60,90,200,0.35)',
          cursor: locked ? 'not-allowed' : 'pointer',
          opacity: locked ? 0.6 : 1,
        }}
      >
        {playerName ? (
          <>
            {selectedTeam?.flagUrl && <Flag url={selectedTeam.flagUrl} name={selectedTeam.name} size="md" />}
            <span className="text-white font-semibold text-sm flex-1">{playerName}</span>
            {selectedPlayer?.position && <span className="text-xs text-gray-500 shrink-0">{selectedPlayer.position}</span>}
          </>
        ) : (
          <span className="text-gray-400 text-sm">{t.specialBets.searchPlayer}</span>
        )}
        {playerName && !locked && (
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-500 hover:text-red-400 text-xs ml-1 px-1 transition-colors shrink-0"
            title="Clear selection"
          >✕</button>
        )}
        <span className="ml-auto text-gray-500 text-xs shrink-0">{open ? '▲' : '▼'}</span>
      </div>

      {/* Dropdown */}
      {open && !locked && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(10,18,48,0.97)',
            border: '1px solid rgba(42,57,141,0.45)',
            backdropFilter: 'blur(12px)',
            maxHeight: '380px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="p-2 space-y-2 border-b" style={{ borderColor: 'rgba(42,57,141,0.3)', flexShrink: 0 }}>
            <div className="relative">
              <input
                type="text"
                className="input w-full text-sm py-2 pr-8"
                placeholder={`🔍 ${t.specialBets.searchPlayer}`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                  onClick={() => setSearch('')}
                >✕</button>
              )}
            </div>
            <TeamPicker teams={teams} value={teamId} onChange={id => setTeamId(id)} />
            <p className="text-xs text-gray-600 px-0.5">{filtered.length} players</p>
          </div>

          <div style={{ overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-5">{t.specialBets.noPlayersYet}</p>
            ) : (
              filtered.map(p => {
                const isSelected = p.name === playerName;
                const pTeam = teams.find(tm => tm.id === p.teamId);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 transition-all"
                    style={{
                      borderBottom: '1px solid rgba(42,57,141,0.12)',
                      background: isSelected ? 'rgba(42,57,141,0.35)' : 'transparent',
                      borderLeft: isSelected ? '3px solid #2A398D' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(42,57,141,0.18)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(42,57,141,0.35)' : 'transparent'; }}
                    onClick={() => handleSelect(p)}
                  >
                    {pTeam?.flagUrl && <Flag url={pTeam.flagUrl} name={pTeam.name} size="sm" />}
                    <span className="text-white font-medium flex-1">{p.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{p.position ?? '—'}</span>
                    {isSelected && <span style={{ color: '#3CAC3B', fontSize: '0.8rem' }}>✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
