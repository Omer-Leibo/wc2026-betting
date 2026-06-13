import { useEffect, useMemo, useState, useCallback } from 'react';
import { matchService } from '../services/matchService';
import type { Match, Team, TeamStanding } from '../types';
import { Flag } from '../components/Flag';
import { R32_BRACKET } from '../config/wc2026Bracket';

// ─── Layout constants ─────────────────────────────────────────────────────────
const UNIT     = 52;   // px per R32 slot — vertical rhythm
const CARD_H   = 48;   // px — card height
const CARD_W   = 180;  // px — card width
const COL_GAP  = 36;   // px — space between columns (used for connector lines)
const COL_W    = CARD_W + COL_GAP; // 216px per stage column
const TOP_PAD  = 32;   // px — top padding inside the bracket (leaves room for headers)

// Total bracket canvas size
const BRACKET_W = COL_W * 4 + CARD_W + 16;  // 1032px
const BRACKET_H = 16 * UNIT + TOP_PAD + CARD_H + 24 + 60;

// Stage column x-positions (left edge of card)
const STAGE_X: Record<string, number> = {
  ROUND_OF_32:   0,
  ROUND_OF_16:   COL_W,
  QUARTER_FINAL: COL_W * 2,
  SEMI_FINAL:    COL_W * 3,
  FINAL:         COL_W * 4,
  THIRD_PLACE:   COL_W * 4,
};

// Vertical center of a match card given stage + slot number
function slotCenterY(stage: string, slot: number): number {
  switch (stage) {
    case 'ROUND_OF_32':   return TOP_PAD + (slot - 0.5) * UNIT;
    case 'ROUND_OF_16':   return TOP_PAD + (2 * slot - 1) * UNIT;
    case 'QUARTER_FINAL': return TOP_PAD + (4 * slot - 2) * UNIT;
    case 'SEMI_FINAL':    return TOP_PAD + (8 * slot - 4) * UNIT;
    case 'FINAL':         return TOP_PAD + 8 * UNIT;
    case 'THIRD_PLACE':   return TOP_PAD + 8 * UNIT + CARD_H + 20;
    default:              return TOP_PAD;
  }
}

// Previous stage in the bracket progression
const PREV_STAGE: Partial<Record<string, string>> = {
  ROUND_OF_16:   'ROUND_OF_32',
  QUARTER_FINAL: 'ROUND_OF_16',
  SEMI_FINAL:    'QUARTER_FINAL',
  FINAL:         'SEMI_FINAL',
};

// How many slots each stage has
const STAGE_SLOTS: Record<string, number> = {
  ROUND_OF_32:   16,
  ROUND_OF_16:   8,
  QUARTER_FINAL: 4,
  SEMI_FINAL:    2,
  FINAL:         1,
  THIRD_PLACE:   1,
};

// Pretty stage labels
const STAGE_LABEL: Record<string, string> = {
  ROUND_OF_32:   'R32',
  ROUND_OF_16:   'R16',
  QUARTER_FINAL: 'QF',
  SEMI_FINAL:    'SF',
  FINAL:         'Final',
};

// Status colours
function cardBorderColor(status: string | undefined): string {
  if (status === 'FINISHED') return 'rgba(255,255,255,0.10)';
  if (status === 'LIVE')     return 'rgba(239,68,68,0.55)';
  return 'rgba(255,255,255,0.07)';
}
function cardBg(status: string | undefined): string {
  if (status === 'LIVE') return 'rgba(239,68,68,0.07)';
  return 'rgba(12,18,52,0.92)';
}

// ─── Standings helpers ────────────────────────────────────────────────────────

/** True if the team record is a real, known team (not a TBD placeholder) */
function isRealTeam(team: Team | null | undefined): boolean {
  if (!team) return false;
  const code = team.code?.toUpperCase();
  return code !== 'TBD' && code !== 'TBA' && !!team.flagUrl;
}

/** Resolve a position string like "1A" or "2B" against current standings.
 *  Returns the team (if standings exist) and whether the group is fully played. */
function resolvePos(
  pos: string,
  standings: Record<string, TeamStanding[]>,
): { team: Team | null; confirmed: boolean } {
  if (pos === '3rd') return { team: null, confirmed: false };

  const rank  = parseInt(pos[0], 10);   // 1 or 2
  const group = pos[1];                 // A–L

  const rows = standings[group];
  if (!rows || rows.length === 0) return { team: null, confirmed: false };

  const row = rows[rank - 1];
  if (!row) return { team: null, confirmed: false };

  // A group is "confirmed" once every team has played all 3 group games
  const confirmed = rows.every(r => r.played >= 3);

  return { team: row.team, confirmed };
}

/** Human-readable position label, e.g. "1A" → "1st · Grp A" */
function posLabel(pos: string): string {
  if (pos === '3rd') return 'Best 3rd';
  const rank  = parseInt(pos[0], 10);
  const group = pos[1];
  const suffix = rank === 1 ? '1st' : rank === 2 ? '2nd' : `${rank}th`;
  return `${suffix} · Grp ${group}`;
}

// ─── Placeholder type ─────────────────────────────────────────────────────────

interface Placeholder {
  team: Team | null;
  pos: string;
  confirmed: boolean;
}

// ─── MatchCard ────────────────────────────────────────────────────────────────
interface CardProps {
  match: Match | null;
  top: number;
  left: number;
  slot: number;
  stage: string;
  homePlaceholder?: Placeholder;
  awayPlaceholder?: Placeholder;
}

function MatchCard({ match, top, left, slot, stage, homePlaceholder, awayPlaceholder }: CardProps) {
  const isFinished = match?.status === 'FINISHED';
  const isLive     = match?.status === 'LIVE';
  const homeWin = isFinished && (match!.homeScore ?? 0) > (match!.awayScore ?? 0);
  const awayWin = isFinished && (match!.awayScore ?? 0) > (match!.homeScore ?? 0);

  const style: React.CSSProperties = {
    position: 'absolute',
    top,
    left,
    width:  CARD_W,
    height: CARD_H,
    border: `1px solid ${cardBorderColor(match?.status)}`,
    background: cardBg(match?.status),
    borderRadius: 6,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: isLive ? '0 0 8px rgba(239,68,68,0.25)' : undefined,
  };

  // Tiny slot label above card
  const slotLabel = stage === 'FINAL' ? 'Final' :
                    stage === 'THIRD_PLACE' ? '3rd' :
                    `${STAGE_LABEL[stage]} ${slot}`;

  const TeamRow = ({
    team,
    score,
    isWinner,
    placeholder,
  }: {
    team?: Match['homeTeam'];
    score?: number;
    isWinner: boolean;
    placeholder?: Placeholder;
  }) => {
    const real = isRealTeam(team) ? team : null;
    // Use real DB team first; fall back to standings-resolved team; fall back to label
    const displayTeam = real ?? placeholder?.team ?? null;
    // Tentative = we have a team from standings but their group isn't complete yet
    const isTentative = !real && !!placeholder?.team && !placeholder.confirmed;
    const isScorable  = isFinished || isLive;

    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        paddingInline: 8,
        background: isWinner ? 'rgba(255,255,255,0.04)' : 'transparent',
      }}>
        {displayTeam ? (
          <>
            <span style={{ opacity: isTentative ? 0.65 : 1, display: 'flex', alignItems: 'center' }}>
              <Flag url={displayTeam.flagUrl} name={displayTeam.name} size="sm" />
            </span>
            <span style={{
              flex: 1,
              fontSize: 11,
              fontWeight: isWinner ? 700 : 400,
              color: isWinner ? '#fff' : isScorable ? '#6b7280' : '#d1d5db',
              opacity: isTentative ? 0.65 : 1,
              fontStyle: isTentative ? 'italic' : 'normal',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '0.02em',
            }}>
              {displayTeam.code}
            </span>
            {isTentative && (
              <span style={{ fontSize: 8, color: '#6b7280', flexShrink: 0 }} title="Group not complete">~</span>
            )}
            {isScorable && score !== undefined && (
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: isWinner ? '#86efac' : isLive ? '#f87171' : '#9ca3af',
                minWidth: 16,
                textAlign: 'right',
              }}>
                {score}
              </span>
            )}
          </>
        ) : placeholder ? (
          // Position label — group hasn't played yet
          <span style={{ fontSize: 10, color: '#4b5563', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
            {posLabel(placeholder.pos)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' }}>TBD</span>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Slot label above card */}
      <div style={{
        position: 'absolute',
        top: top - 13,
        left,
        width: CARD_W,
        textAlign: 'center',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: 'rgba(148,163,216,0.5)',
        textTransform: 'uppercase',
      }}>
        {slotLabel}
      </div>

      <div style={style}>
        <TeamRow
          team={match?.homeTeam}
          score={match?.homeScore ?? undefined}
          isWinner={homeWin}
          placeholder={homePlaceholder}
        />
        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
        <TeamRow
          team={match?.awayTeam}
          score={match?.awayScore ?? undefined}
          isWinner={awayWin}
          placeholder={awayPlaceholder}
        />
      </div>

      {/* LIVE badge */}
      {isLive && (
        <div style={{
          position: 'absolute',
          top: top + 2,
          left: left + CARD_W - 30,
          fontSize: 8,
          fontWeight: 700,
          color: '#f87171',
          letterSpacing: '0.05em',
        }}>
          LIVE
        </div>
      )}
    </>
  );
}

// ─── SVG Connectors ───────────────────────────────────────────────────────────
function BracketConnectors() {
  const lines: React.ReactElement[] = [];

  const stroke = 'rgba(80,110,200,0.30)';
  const sw = 1.5;

  const CHILD_STAGES = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const;

  for (const stage of CHILD_STAGES) {
    const slots = STAGE_SLOTS[stage];
    const prevStage = PREV_STAGE[stage]!;
    const px = STAGE_X[prevStage] + CARD_W;  // right edge of parent cards
    const cx = STAGE_X[stage];               // left edge of child card
    const midX = px + COL_GAP / 2;

    for (let j = 1; j <= slots; j++) {
      const p1slot = 2 * j - 1;
      const p2slot = 2 * j;
      const p1y = slotCenterY(prevStage, p1slot);
      const p2y = slotCenterY(prevStage, p2slot);
      const cy  = slotCenterY(stage, j);

      const key = `${stage}-${j}`;
      lines.push(
        <g key={key} stroke={stroke} strokeWidth={sw} fill="none">
          {/* Horizontal from parent 1 right edge to midpoint */}
          <line x1={px} y1={p1y} x2={midX} y2={p1y} />
          {/* Vertical spine from p1 to p2 */}
          <line x1={midX} y1={p1y} x2={midX} y2={p2y} />
          {/* Horizontal from parent 2 right edge to midpoint */}
          <line x1={px} y1={p2y} x2={midX} y2={p2y} />
          {/* Horizontal from midpoint to child left edge */}
          <line x1={midX} y1={cy} x2={cx} y2={cy} />
        </g>
      );
    }
  }

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: BRACKET_W, height: BRACKET_H, pointerEvents: 'none' }}
    >
      {lines}
    </svg>
  );
}

// ─── Later-stage stages (R16 → Final) ────────────────────────────────────────
const LATER_STAGES = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const;

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BracketPage() {
  const [matches,   setMatches]   = useState<Match[]>([]);
  const [standings, setStandings] = useState<Record<string, TeamStanding[]>>({});
  const [loading,   setLoading]   = useState(true);

  const loadData = useCallback(async () => {
    const [m, s] = await Promise.all([
      matchService.getBracket(),
      matchService.getStandings(),
    ]);
    setMatches(m);
    setStandings(s);
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Poll every 60 s while any knockout or group match is live
  const hasLive = matches.some(m => m.status === 'LIVE');
  useEffect(() => {
    if (!hasLive) return;
    const timer = setInterval(() => loadData().catch(() => {}), 60_000);
    return () => clearInterval(timer);
  }, [hasLive, loadData]);

  // Build lookup: stage → slot → match (only for matches WITH a bracketSlot)
  const slotMap = useMemo(() => {
    const map: Record<string, Record<number, Match>> = {};
    for (const m of matches) {
      if (m.bracketSlot == null) continue;
      if (!map[m.stage]) map[m.stage] = {};
      map[m.stage][m.bracketSlot] = m;
    }
    return map;
  }, [matches]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Knockout Bracket</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            World Cup 2026 · R32 → R16 → QF → SF → Final
          </p>
        </div>
        {hasLive && (
          <span className="flex items-center gap-1.5 text-xs bg-green-900/40 border border-green-700 text-green-400 px-2.5 py-1 rounded-full font-medium">
            <span className="animate-pulse">🔴</span> Live
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white/70 inline-block" /> Confirmed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white/30 inline-block" /><em>~</em>&nbsp;Tentative (group in progress)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-700 inline-block" /> Position TBD
        </span>
      </div>

      {/* ── Bracket canvas ────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 8 }}>
        <div style={{
          position: 'relative',
          width:  BRACKET_W,
          height: BRACKET_H,
          minWidth: BRACKET_W,
        }}>

          {/* Stage column headers */}
          {(['ROUND_OF_32', ...LATER_STAGES] as const).map(stage => (
            <div key={stage} style={{
              position: 'absolute',
              top: 4,
              left: STAGE_X[stage],
              width: CARD_W,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'rgba(148,163,216,0.7)',
              textTransform: 'uppercase',
            }}>
              {STAGE_LABEL[stage]}
            </div>
          ))}
          {/* 3rd Place header */}
          <div style={{
            position: 'absolute',
            top: slotCenterY('THIRD_PLACE', 1) - CARD_H / 2 - 13,
            left: STAGE_X.THIRD_PLACE,
            width: CARD_W,
            textAlign: 'center',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'rgba(148,163,216,0.4)',
            textTransform: 'uppercase',
          }}>
            3rd Place
          </div>

          {/* SVG connector lines */}
          <BracketConnectors />

          {/* ── R32 — always render all 16 slots using config + standings ── */}
          {R32_BRACKET.map(({ slot, homePos, awayPos }) => {
            const match = slotMap['ROUND_OF_32']?.[slot] ?? null;
            const homeResolved = resolvePos(homePos, standings);
            const awayResolved = resolvePos(awayPos, standings);
            const cy = slotCenterY('ROUND_OF_32', slot);

            return (
              <MatchCard
                key={`ROUND_OF_32-${slot}`}
                match={match}
                top={cy - CARD_H / 2}
                left={STAGE_X['ROUND_OF_32']}
                slot={slot}
                stage="ROUND_OF_32"
                homePlaceholder={{ team: homeResolved.team, pos: homePos, confirmed: homeResolved.confirmed }}
                awayPlaceholder={{ team: awayResolved.team, pos: awayPos, confirmed: awayResolved.confirmed }}
              />
            );
          })}

          {/* ── R16 → Final — show admin-assigned slots ────────────────── */}
          {LATER_STAGES.map(stage => {
            const slots = STAGE_SLOTS[stage];
            return Array.from({ length: slots }, (_, i) => i + 1).map(slot => {
              const match = slotMap[stage]?.[slot] ?? null;
              const cy    = slotCenterY(stage, slot);
              return (
                <MatchCard
                  key={`${stage}-${slot}`}
                  match={match}
                  top={cy - CARD_H / 2}
                  left={STAGE_X[stage]}
                  slot={slot}
                  stage={stage}
                />
              );
            });
          })}

          {/* 3rd Place */}
          {(() => {
            const match = slotMap['THIRD_PLACE']?.[1] ?? null;
            const cy = slotCenterY('THIRD_PLACE', 1);
            return (
              <MatchCard
                key="THIRD_PLACE-1"
                match={match}
                top={cy - CARD_H / 2}
                left={STAGE_X.THIRD_PLACE}
                slot={1}
                stage="THIRD_PLACE"
              />
            );
          })()}
        </div>
      </div>

      {/* ── R32 quick-reference table (compact, useful on mobile too) ─────── */}
      <div className="space-y-2 pt-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Round of 32 — Matchups
        </h2>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {R32_BRACKET.map(({ slot, homePos, awayPos }) => {
            const match = slotMap['ROUND_OF_32']?.[slot] ?? null;
            const homeRes = resolvePos(homePos, standings);
            const awayRes = resolvePos(awayPos, standings);

            const homeTeam = isRealTeam(match?.homeTeam) ? match!.homeTeam : homeRes.team;
            const awayTeam = isRealTeam(match?.awayTeam) ? match!.awayTeam : awayRes.team;

            const homeName = homeTeam?.name ?? posLabel(homePos);
            const awayName = awayTeam?.name ?? posLabel(awayPos);
            const homeTentative = !isRealTeam(match?.homeTeam) && !!homeRes.team && !homeRes.confirmed;
            const awayTentative = !isRealTeam(match?.awayTeam) && !!awayRes.team && !awayRes.confirmed;

            const isLiveMatch    = match?.status === 'LIVE';
            const isFinishedMatch = match?.status === 'FINISHED';

            return (
              <div
                key={slot}
                className="card flex items-center gap-2 py-2 px-3 text-xs"
                style={{
                  border: isLiveMatch ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  background: isLiveMatch ? 'rgba(239,68,68,0.05)' : undefined,
                }}
              >
                {/* Slot number */}
                <span className="text-gray-600 font-mono w-5 shrink-0">{slot}</span>

                {/* Home */}
                <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                  {homeTeam && <Flag url={homeTeam.flagUrl} name={homeTeam.name} size="sm" />}
                  <span className={`truncate font-medium ${isFinishedMatch && (match!.homeScore ?? 0) > (match!.awayScore ?? 0) ? 'text-white' : 'text-gray-300'} ${homeTentative ? 'opacity-60 italic' : ''}`}>
                    {homeName}
                  </span>
                  {isFinishedMatch || isLiveMatch ? (
                    <span className="font-bold tabular-nums text-white ml-1">{match!.homeScore}</span>
                  ) : null}
                </div>

                <span className="text-gray-700 shrink-0">–</span>

                {/* Away */}
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {isFinishedMatch || isLiveMatch ? (
                    <span className="font-bold tabular-nums text-white mr-1">{match!.awayScore}</span>
                  ) : null}
                  <span className={`truncate font-medium ${isFinishedMatch && (match!.awayScore ?? 0) > (match!.homeScore ?? 0) ? 'text-white' : 'text-gray-300'} ${awayTentative ? 'opacity-60 italic' : ''}`}>
                    {awayName}
                  </span>
                  {awayTeam && <Flag url={awayTeam.flagUrl} name={awayTeam.name} size="sm" />}
                </div>

                {/* Status badge */}
                {isLiveMatch && (
                  <span className="text-red-400 animate-pulse shrink-0">🔴</span>
                )}
                {isFinishedMatch && (
                  <span className="text-gray-600 shrink-0 text-[10px]">FT</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
