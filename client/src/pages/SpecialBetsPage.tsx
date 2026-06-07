import { useEffect, useState, useRef, FormEvent } from 'react';
import toast from 'react-hot-toast';
import { betService } from '../services/betService';
import { matchService } from '../services/matchService';
import { useLang } from '../i18n/LanguageContext';
import type { SpecialBet, Team, Player } from '../types';
import dayjs from 'dayjs';

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// ─── Flag image helper ────────────────────────────────────────────────────────
function Flag({ url, name, size = 'md' }: { url?: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'w-5 h-3.5', md: 'w-7 h-5', lg: 'w-10 h-7' }[size];
  if (!url) return <span className={`${dims} rounded-sm bg-gray-700 inline-block`} />;
  return (
    <img
      src={url}
      alt={name}
      className={`${dims} object-contain rounded-sm shadow-sm flex-shrink-0`}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ─── Champion team picker with flags ─────────────────────────────────────────
function TeamPicker({
  teams,
  value,
  onChange,
  locked,
}: {
  teams: Team[];
  value: number | '';
  onChange: (id: number) => void;
  locked?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = teams.find(t => t.id === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search.trim()
    ? teams.filter(team => team.name.toLowerCase().includes(search.toLowerCase()) ||
                           team.code.toLowerCase().includes(search.toLowerCase()))
    : teams;

  // Build group map for filtered teams
  const groupMap: Record<string, Team[]> = {};
  for (const g of GROUPS) {
    const gt = filtered.filter(team => team.group === g);
    if (gt.length) groupMap[g] = gt;
  }

  return (
    <div ref={ref} className="relative flex-1">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !locked && setOpen(o => !o)}
        disabled={locked}
        className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors"
        style={{
          background: 'rgba(10,20,55,0.85)',
          border: '1px solid rgba(60,90,200,0.35)',
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

      {/* Dropdown panel */}
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
          {/* Search bar */}
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

          {/* Scrollable team list */}
          <div className="overflow-y-auto">
            {Object.entries(groupMap).map(([g, groupTeams]) => (
              <div key={g}>
                {/* Group header */}
                <div
                  className="px-3 py-1.5 text-xs font-heading font-bold tracking-widest sticky top-0"
                  style={{ background: 'rgba(5,10,30,0.95)', color: '#4d5ea8' }}
                >
                  {t.specialBets.group} {g}
                </div>

                {/* Teams */}
                {groupTeams.map(team => (
                  <button
                    key={team.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all"
                    style={{
                      background: team.id === value ? 'rgba(42,57,141,0.35)' : 'transparent',
                      borderLeft: team.id === value ? '3px solid #2A398D' : '3px solid transparent',
                    }}
                    onMouseEnter={e => {
                      if (team.id !== value)
                        (e.currentTarget as HTMLElement).style.background = 'rgba(42,57,141,0.18)';
                    }}
                    onMouseLeave={e => {
                      if (team.id !== value)
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                    onClick={() => { onChange(team.id); setOpen(false); setSearch(''); }}
                  >
                    <Flag url={team.flagUrl} name={team.name} size="md" />
                    <span className="text-white text-sm font-semibold">{team.name}</span>
                    <span className="text-gray-500 text-xs ml-auto font-display tracking-wider">{team.code}</span>
                    {team.id === value && (
                      <span style={{ color: '#3CAC3B', fontSize: '0.8rem', marginLeft: '4px' }}>✓</span>
                    )}
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

// ─── Combined search + team filter + player list picker ──────────────────────
function TeamThenPlayerPicker({
  teams, players, playerName, onSelect, locked,
}: {
  teams: Team[];
  players: Player[];
  playerName: string;
  onSelect: (playerName: string) => void;
  locked?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen]     = useState(!playerName);
  const [search, setSearch] = useState('');
  const [teamId, setTeamId] = useState<number | ''>(() => {
    if (!playerName) return '';
    return players.find(p => p.name === playerName)?.teamId ?? '';
  });

  const selectedPlayer = players.find(p => p.name === playerName);
  const selectedTeam   = teams.find(t => t.id === selectedPlayer?.teamId);

  // Combined filter: search text AND/OR team
  const filtered = players.filter(p => {
    const matchesSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
    const matchesTeam   = teamId === '' || p.teamId === teamId;
    return matchesSearch && matchesTeam;
  }).slice(0, 60);

  const handleSelect = (p: Player) => {
    onSelect(p.name);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect('');
    setSearch('');
    setTeamId('');
    setOpen(true);
  };

  const handleTeamChange = (id: number) => {
    setTeamId(id);
    // Don't clear player — just filter the list
  };

  return (
    <div className="flex-1 space-y-2">
      {/* ── Current selection (collapsed state) ── */}
      {playerName && !open && (
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
          style={{ background: 'rgba(10,20,55,0.85)', border: '1px solid rgba(60,172,59,0.4)' }}
        >
          {selectedTeam?.flagUrl && (
            <Flag url={selectedTeam.flagUrl} name={selectedTeam.name} size="md" />
          )}
          <span className="text-white font-semibold text-sm flex-1">{playerName}</span>
          {selectedPlayer?.position && (
            <span className="text-xs text-gray-500">{selectedPlayer.position}</span>
          )}
          {!locked && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-white text-xs ml-1 transition-colors"
              title="Change player"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ── Open picker ── */}
      {open && !locked && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(60,90,200,0.35)', background: 'rgba(10,18,48,0.97)' }}
        >
          {/* Search bar */}
          <div className="p-2 space-y-2 border-b" style={{ borderColor: 'rgba(42,57,141,0.3)' }}>
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
            {/* Team filter */}
            <TeamPicker teams={teams} value={teamId} onChange={handleTeamChange} />
            {/* Close / deselect strip */}
            <div className="flex items-center justify-between text-xs text-gray-500 px-0.5">
              <span>{filtered.length} players</span>
              {playerName && (
                <button type="button" className="hover:text-white transition-colors" onClick={() => setOpen(false)}>
                  ✕ Close
                </button>
              )}
            </div>
          </div>

          {/* Player list */}
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-5">{t.specialBets.noPlayersYet}</p>
            ) : (
              filtered.map(p => {
                const isSelected = p.name === playerName;
                const pTeam = teams.find(t => t.id === p.teamId);
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

      {/* Locked state with no selection */}
      {locked && !playerName && (
        <div className="px-3 py-2.5 rounded-lg text-gray-500 text-sm"
          style={{ background: 'rgba(10,20,55,0.85)', border: '1px solid rgba(60,90,200,0.2)', opacity: 0.6 }}>
          {t.specialBets.noPlayersYet}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SpecialBetsPage() {
  const { t } = useLang();

  const BET_TYPES = [
    { type: 'CHAMPION'    as const, label: t.specialBets.champion,   description: t.specialBets.championDesc,   points: 10 },
    { type: 'TOP_SCORER'  as const, label: t.specialBets.topScorer,  description: t.specialBets.topScorerDesc,  points: 12 },
    { type: 'TOP_ASSISTS' as const, label: t.specialBets.topAssists, description: t.specialBets.topAssistsDesc, points: 15 },
  ];

  const [specialBets, setSpecialBets]   = useState<SpecialBet[]>([]);
  const [teams, setTeams]               = useState<Team[]>([]);
  const [players, setPlayers]           = useState<Player[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState<string | null>(null);
  const [firstKickoff, setFirstKickoff] = useState<string | null>(null);

  const [championTeamId, setChampionTeamId] = useState<number | ''>('');
  const [topScorer, setTopScorer]           = useState('');
  const [topAssists, setTopAssists]         = useState('');

  useEffect(() => {
    Promise.all([
      betService.getMySpecialBets(),
      matchService.getTeams(),
      matchService.getPlayers(),
      matchService.getFirstKickoff(),
    ])
      .then(([bets, teamsData, playersData, kickoff]) => {
        setSpecialBets(bets);
        setTeams(teamsData);
        setPlayers(playersData);
        setFirstKickoff(kickoff);
        const champion = bets.find(b => b.type === 'CHAMPION');
        const scorer   = bets.find(b => b.type === 'TOP_SCORER');
        const assists  = bets.find(b => b.type === 'TOP_ASSISTS');
        if (champion?.teamId)    setChampionTeamId(champion.teamId);
        if (scorer?.playerName)  setTopScorer(scorer.playerName);
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
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const noPlayers      = players.length === 0;
  const tournamentLocked = firstKickoff !== null &&
    new Date(firstKickoff).getTime() - Date.now() <= 60_000;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1
          className="font-heading text-5xl tracking-wide"
          style={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #F5A623 0%, #ffffff 50%, #2A398D 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {t.specialBets.title}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">{t.specialBets.subtitle}</p>
      </div>

      {/* Locked banner */}
      {tournamentLocked && (
        <div
          className="card flex items-center gap-3 text-sm"
          style={{ borderLeft: '4px solid #E61D25', background: 'rgba(230,29,37,0.10)' }}
        >
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-semibold text-red-400">{t.specialBets.locked}</p>
            <p className="text-red-400/70 text-xs mt-0.5">
              {t.specialBets.lockedDesc}
              {firstKickoff && ` ${t.specialBets.firstKickoff} ${dayjs(firstKickoff).format('D MMM YYYY · HH:mm')}`}
            </p>
          </div>
        </div>
      )}

      {noPlayers && !tournamentLocked && (
        <div
          className="card text-sm"
          style={{ borderLeft: '4px solid #F5A623', background: 'rgba(245,166,35,0.08)', color: '#f9bc3a' }}
        >
          {t.specialBets.noPlayersMsg}
        </div>
      )}

      {/* Bet cards */}
      {BET_TYPES.map(({ type, label, description, points }, index) => {
        const existing  = existingBet(type);
        const isSaving  = saving === type;
        const isPlayer  = type === 'TOP_SCORER' || type === 'TOP_ASSISTS';
        const accentColor =
          type === 'CHAMPION'    ? '#F5A623' :
          type === 'TOP_SCORER'  ? '#2A398D' : '#3CAC3B';

        return (
          <div
            key={type}
            className="card space-y-4"
            style={{
              borderLeft: `4px solid ${accentColor}`,
              // Reverse z-index so each card's dropdown floats above the cards below it.
              // backdrop-filter creates a stacking context — without explicit z-index the
              // later card (Top Scorer) would paint over the Champion card's open dropdown.
              position: 'relative',
              zIndex: BET_TYPES.length - index,
            }}
          >
            {/* Card header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl text-white">{label}</h2>
                <p className="text-gray-400 text-sm mt-0.5">{description}</p>
              </div>
              <span
                className="font-heading text-2xl tracking-wide shrink-0 ml-2 font-black"
                style={{ color: accentColor }}
              >
                {points} {t.specialBets.pts}
              </span>
            </div>

            {/* Current bet display */}
            {existing && (
              <div
                className="rounded-lg px-3 py-2.5 text-sm flex items-center gap-2.5"
                style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}33` }}
              >
                {type === 'CHAMPION' && existing.team?.flagUrl && (
                  <Flag url={existing.team.flagUrl} name={existing.team.name ?? ''} size="md" />
                )}
                <span className="text-gray-300">{t.specialBets.currentBet}</span>
                <span className="text-white font-semibold">
                  {type === 'CHAMPION' ? existing.team?.name ?? '—' : existing.playerName ?? '—'}
                </span>
                {existing.pointsAwarded != null && (
                  <span className={`ml-auto font-bold ${existing.pointsAwarded > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {existing.pointsAwarded > 0 ? `+${existing.pointsAwarded} ${t.common.pts} ✓` : `✗ 0 ${t.common.pts}`}
                  </span>
                )}
              </div>
            )}

            {/* Input row */}
            <form onSubmit={e => handleSave(e, type)} className="flex gap-2 items-start">
              {type === 'CHAMPION' ? (
                <TeamPicker
                  teams={teams}
                  value={championTeamId}
                  onChange={setChampionTeamId}
                  locked={tournamentLocked}
                />
              ) : (
                <TeamThenPlayerPicker
                  teams={teams}
                  players={players}
                  playerName={type === 'TOP_SCORER' ? topScorer : topAssists}
                  onSelect={v => type === 'TOP_SCORER' ? setTopScorer(v) : setTopAssists(v)}
                  locked={tournamentLocked}
                />
              )}
              <button
                type="submit"
                className="btn-primary whitespace-nowrap self-start"
                disabled={isSaving || (isPlayer && noPlayers) || tournamentLocked}
              >
                {isSaving ? t.specialBets.saving : existing ? t.specialBets.update : t.specialBets.save}
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
