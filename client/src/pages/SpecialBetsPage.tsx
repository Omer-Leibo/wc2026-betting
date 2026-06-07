import { useEffect, useState, FormEvent } from 'react';
import toast from 'react-hot-toast';
import { betService } from '../services/betService';
import { matchService } from '../services/matchService';
import { useLang } from '../i18n/LanguageContext';
import type { SpecialBet, Team, Player } from '../types';
import dayjs from 'dayjs';
import { Flag } from '../components/Flag';
import { TeamPicker } from '../components/pickers/TeamPicker';
import { PlayerPicker } from '../components/pickers/PlayerPicker';

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
                <PlayerPicker
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
