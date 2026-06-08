import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { matchService } from '../services/matchService';
import type { Match } from '../types';
import { Flag } from '../components/Flag';

// ─── Layout constants ─────────────────────────────────────────────────────────
const UNIT     = 52;   // px per R32 slot — vertical rhythm
const CARD_H   = 48;   // px — card height
const CARD_W   = 180;  // px — card width
const COL_GAP  = 36;   // px — space between columns (used for connector lines)
const COL_W    = CARD_W + COL_GAP; // 216px per stage column
const TOP_PAD  = 32;   // px — top padding inside the bracket (leaves room for headers)

// Total bracket canvas size
const BRACKET_W = COL_W * 4 + CARD_W + 16;  // 1032px
const BRACKET_H = 16 * UNIT + TOP_PAD + CARD_H + 24 + 60; // ~948px (handles 3rd place)

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

// ─── MatchCard ────────────────────────────────────────────────────────────────
interface CardProps {
  match: Match | null;
  top: number;
  left: number;
  slot: number;
  stage: string;
}

function MatchCard({ match, top, left, slot, stage }: CardProps) {
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
    team, score, isWinner,
  }: {
    team?: Match['homeTeam'];
    score?: number;
    isWinner: boolean;
  }) => (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      paddingInline: 8,
      background: isWinner ? 'rgba(255,255,255,0.04)' : 'transparent',
    }}>
      {team ? (
        <>
          <Flag url={team.flagUrl} name={team.name} size="sm" />
          <span style={{
            flex: 1,
            fontSize: 11,
            fontWeight: isWinner ? 700 : 400,
            color: isWinner ? '#fff' : isFinished ? '#6b7280' : '#d1d5db',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.02em',
          }}>
            {team.code}
          </span>
          {(isFinished || isLive) && score !== undefined && (
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
      ) : (
        <span style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' }}>TBD</span>
      )}
    </div>
  );

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
          score={match?.homeScore}
          isWinner={homeWin}
        />
        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
        <TeamRow
          team={match?.awayTeam}
          score={match?.awayScore}
          isWinner={awayWin}
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BracketPage() {
  const [matches, setMatches]   = useState<Match[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    matchService.getBracket()
      .then(setMatches)
      .finally(() => setLoading(false));
  }, []);

  // Build lookup: stage → slot → match
  const slotMap = useMemo(() => {
    const map: Record<string, Record<number, Match>> = {};
    for (const m of matches) {
      if (m.bracketSlot == null) continue;
      if (!map[m.stage]) map[m.stage] = {};
      map[m.stage][m.bracketSlot] = m;
    }
    return map;
  }, [matches]);

  // Matches without a bracketSlot assigned
  const unslotted = matches.filter(m => m.bracketSlot == null);

  // Count how many slots across main stages have been filled
  const MAIN_STAGES = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const;
  const totalFilled = MAIN_STAGES.reduce((acc, s) =>
    acc + Object.keys(slotMap[s] ?? {}).length, 0);
  const hasAnySlots = totalFilled > 0;

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
        {hasAnySlots && (
          <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
            {totalFilled} / {31} matches positioned
          </span>
        )}
      </div>

      {!hasAnySlots ? (
        /* ── Not yet set up ─────────────────────────────────────────────── */
        <div className="card py-16 text-center space-y-3 max-w-md mx-auto">
          <p className="text-4xl">🔱</p>
          <p className="text-gray-400 font-medium">Bracket not yet available</p>
          <p className="text-gray-600 text-sm">
            The knockout stage bracket will appear here once the admin assigns bracket slots to
            the Round of 32 matches.
          </p>
        </div>
      ) : (
        /* ── Bracket canvas ─────────────────────────────────────────────── */
        <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 8 }}>
          <div style={{
            position: 'relative',
            width:  BRACKET_W,
            height: BRACKET_H,
            minWidth: BRACKET_W,
          }}>

            {/* Stage column headers */}
            {MAIN_STAGES.map(stage => (
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

            {/* Main bracket stages (R32 → Final) */}
            {MAIN_STAGES.map(stage => {
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
      )}

      {/* ── Unslotted matches (visible to all, useful to know what's coming) */}
      {unslotted.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            Upcoming Knockout Matches
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl">
            {unslotted.map(m => (
              <div
                key={m.id}
                className="card flex items-center gap-3 py-2.5 px-3"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {/* Stage badge */}
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 shrink-0 w-12 text-center">
                  {STAGE_LABEL[m.stage] ?? m.stage}
                </span>

                {/* Teams / TBD */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  {m.homeTeam ? (
                    <>
                      <Flag url={m.homeTeam.flagUrl} name={m.homeTeam.name} size="sm" />
                      <span className="text-xs text-white truncate">{m.homeTeam.code}</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-600 italic">TBD</span>
                  )}
                  <span className="text-gray-700 text-xs">vs</span>
                  {m.awayTeam ? (
                    <>
                      <span className="text-xs text-white truncate">{m.awayTeam.code}</span>
                      <Flag url={m.awayTeam.flagUrl} name={m.awayTeam.name} size="sm" />
                    </>
                  ) : (
                    <span className="text-xs text-gray-600 italic">TBD</span>
                  )}
                </div>

                {/* Date */}
                <span className="text-xs text-gray-600 shrink-0">
                  {dayjs(m.matchDate).format('D MMM')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
