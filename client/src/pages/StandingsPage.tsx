import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { matchService } from '../services/matchService';
import { useLang } from '../i18n/LanguageContext';
import { Flag } from '../components/Flag';
import type { TeamStanding } from '../types';

// Groups in tournament order
const GROUP_ORDER = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// ── GD formatter ─────────────────────────────────────────────────────────────
function fmtGD(gd: number): string {
  if (gd > 0) return `+${gd}`;
  return String(gd);
}

// ── Position qualifier colour ─────────────────────────────────────────────────
// WC 2026: top 2 per group advance; best 8 of 12 third-place teams also qualify.
function positionStyle(pos: number): { border: string; bg: string } {
  if (pos <= 2) return { border: 'border-l-2 border-l-green-500', bg: '' };
  if (pos === 3) return { border: 'border-l-2 border-l-amber-500', bg: '' };
  return { border: '', bg: '' };
}

// ── Single group table ────────────────────────────────────────────────────────
function GroupTable({
  groupLetter,
  rows,
}: {
  groupLetter: string;
  rows: TeamStanding[];
}) {
  const { t } = useLang();
  const hasLive = rows.some(r => r.live);
  const anyPlayed = rows.some(r => r.played > 0);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(42,57,141,0.4)', background: 'rgba(5,10,30,0.6)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: 'rgba(42,57,141,0.25)', borderBottom: '1px solid rgba(42,57,141,0.3)' }}
      >
        <span className="font-heading font-bold text-sm tracking-wider text-white">
          {t.standings.group} {groupLetter}
        </span>
        {hasLive && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-900/40 border border-green-700/50 px-2 py-0.5 rounded-full">
            <span className="animate-pulse">🔴</span> {t.standings.liveGroup}
          </span>
        )}
      </div>

      {/* Column headers */}
      <div className="grid text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 py-1.5"
        style={{ gridTemplateColumns: '1.6rem 1fr repeat(6, 1.8rem)' }}>
        <span />
        <span>{/* team name */}</span>
        <span className="text-center">{t.standings.played}</span>
        <span className="text-center">{t.standings.won}</span>
        <span className="text-center">{t.standings.drawn}</span>
        <span className="text-center">{t.standings.lost}</span>
        <span className="text-center">{t.standings.gd}</span>
        <span className="text-center font-bold text-gray-400">{t.standings.pts}</span>
      </div>

      {/* Rows */}
      {rows.map((row, idx) => {
        const pos = idx + 1;
        const { border } = positionStyle(pos);
        const isLiveRow = row.live;
        return (
          <div
            key={row.team.id}
            className={`grid items-center px-2 py-1.5 text-sm
              ${border}
              ${idx < rows.length - 1 ? 'border-b border-gray-800/60' : ''}
              ${isLiveRow ? 'bg-green-950/20' : idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}
            `}
            style={{ gridTemplateColumns: '1.6rem 1fr repeat(6, 1.8rem)' }}
          >
            {/* Position */}
            <span className={`text-xs font-bold text-center ${
              pos === 1 ? 'text-yellow-400' : pos === 2 ? 'text-gray-300' : pos === 3 ? 'text-amber-500' : 'text-gray-600'
            }`}>
              {pos}
            </span>

            {/* Team */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Flag url={row.team.flagUrl} name={row.team.name} size="sm" />
              <span className={`truncate text-xs font-medium ${anyPlayed && row.pts > 0 ? 'text-white' : 'text-gray-400'}`}>
                {row.team.name}
              </span>
              {isLiveRow && <span className="text-[8px] text-green-400 shrink-0">●</span>}
            </div>

            {/* Stats */}
            <span className="text-center text-xs text-gray-400 tabular-nums">{row.played}</span>
            <span className="text-center text-xs tabular-nums text-green-400">{row.won}</span>
            <span className="text-center text-xs tabular-nums text-gray-400">{row.drawn}</span>
            <span className="text-center text-xs tabular-nums text-red-400">{row.lost}</span>
            <span className={`text-center text-xs tabular-nums font-medium ${
              row.gd > 0 ? 'text-green-400' : row.gd < 0 ? 'text-red-400' : 'text-gray-500'
            }`}>
              {fmtGD(row.gd)}
            </span>
            <span className="text-center text-sm font-bold text-white tabular-nums">{row.pts}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StandingsPage() {
  const { t } = useLang();
  const [standings, setStandings] = useState<Record<string, TeamStanding[]>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() =>
    matchService.getStandings().then(setStandings).catch(() => toast.error('Failed to load standings')),
  []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Poll every 60 s when any group has a live match
  const hasLive = Object.values(standings).some(rows => rows.some(r => r.live));
  useEffect(() => {
    if (!hasLive) return;
    const timer = setInterval(() => loadData().catch(() => {}), 60_000);
    return () => clearInterval(timer);
  }, [hasLive, loadData]);

  const hasAnyData = Object.keys(standings).length > 0;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Build ordered groups (only groups that have teams)
  const orderedGroups = GROUP_ORDER.filter(g => standings[g] && standings[g].length > 0);

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Title row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t.standings.title}</h1>
          {hasLive && (
            <span className="flex items-center gap-1.5 text-xs bg-green-900/40 border border-green-700 text-green-400 px-2.5 py-1 rounded-full font-medium">
              <span className="animate-pulse">🔴</span> Live
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{t.standings.advancesNote}</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
          {t.standings.qualifies}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
          {t.standings.mayQualify}
        </span>
      </div>

      {/* No data yet */}
      {!hasAnyData && (
        <div className="card text-center py-12">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-gray-400">{t.standings.noData}</p>
        </div>
      )}

      {/* Group grid: 2 columns on md+, 1 on mobile */}
      {hasAnyData && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orderedGroups.map(g => (
            <GroupTable key={g} groupLetter={g} rows={standings[g]} />
          ))}
        </div>
      )}
    </div>
  );
}
