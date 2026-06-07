import { useEffect, useState, useRef } from 'react';
import { Flag } from '../Flag';
import { useLang } from '../../i18n/LanguageContext';
import type { Team } from '../../types';

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

export function TeamPicker({
  teams, value, onChange, locked,
}: {
  teams: Team[];
  value: number | '';
  onChange: (id: number) => void;
  locked?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = teams.find(tm => tm.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search.trim()
    ? teams.filter(team =>
        team.name.toLowerCase().includes(search.toLowerCase()) ||
        team.code.toLowerCase().includes(search.toLowerCase()))
    : teams;

  const groupMap: Record<string, Team[]> = {};
  for (const g of GROUPS) {
    const gt = filtered.filter(team => team.group === g);
    if (gt.length) groupMap[g] = gt;
  }

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => !locked && setOpen(o => !o)}
        disabled={locked}
        className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors"
        style={{
          background: 'rgba(10,20,55,0.85)',
          border: open ? '1px solid rgba(60,90,200,0.6)' : '1px solid rgba(60,90,200,0.35)',
          cursor: locked ? 'not-allowed' : 'pointer',
          opacity: locked ? 0.6 : 1,
        }}
      >
        {selected ? (
          <>
            <Flag url={selected.flagUrl} name={selected.name} size="md" />
            <span className="text-white font-semibold text-sm">{selected.name}</span>
            <span className="text-gray-500 text-xs ml-1">{selected.code}</span>
          </>
        ) : (
          <span className="text-gray-400 text-sm">{t.specialBets.selectTeam}</span>
        )}
        <span className="ml-auto text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(10,18,48,0.97)',
            border: '1px solid rgba(42,57,141,0.45)',
            backdropFilter: 'blur(12px)',
            maxHeight: '340px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="p-2 border-b" style={{ borderColor: 'rgba(42,57,141,0.3)', flexShrink: 0 }}>
            <input
              type="text"
              className="input text-sm py-1.5"
              placeholder={t.specialBets.searchTeam}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto">
            {Object.entries(groupMap).map(([g, groupTeams]) => (
              <div key={g}>
                <div
                  className="px-3 py-1.5 text-xs font-heading font-bold tracking-widest sticky top-0"
                  style={{ background: 'rgba(5,10,30,0.95)', color: '#4d5ea8' }}
                >
                  {t.specialBets.group} {g}
                </div>
                {groupTeams.map(team => (
                  <button
                    key={team.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all"
                    style={{
                      background: team.id === value ? 'rgba(42,57,141,0.35)' : 'transparent',
                      borderLeft: team.id === value ? '3px solid #2A398D' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { if (team.id !== value) (e.currentTarget as HTMLElement).style.background = 'rgba(42,57,141,0.18)'; }}
                    onMouseLeave={e => { if (team.id !== value) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    onClick={() => { onChange(team.id); setOpen(false); setSearch(''); }}
                  >
                    <Flag url={team.flagUrl} name={team.name} size="md" />
                    <span className="text-white text-sm font-semibold">{team.name}</span>
                    <span className="text-gray-500 text-xs ml-auto font-display tracking-wider">{team.code}</span>
                    {team.id === value && <span style={{ color: '#3CAC3B', fontSize: '0.8rem' }}>✓</span>}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(groupMap).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-6">{t.specialBets.noTeams}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
