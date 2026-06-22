import { useEffect, useState } from 'react';
import { leaderboardService } from '../../services/leaderboardService';
import type { UserBreakdown } from '../../services/leaderboardService';

const STAGE_LABEL: Record<string, string> = {
  ROUND_OF_32:   'R32',
  ROUND_OF_16:   'R16',
  QUARTER_FINAL: 'QF',
  SEMI_FINAL:    'SF',
  THIRD_PLACE:   '3rd',
  FINAL:         'Final',
};

// Mini accuracy bar: exact (gold) + correct (green) + wrong (red)
function AccuracyBar({ exact, correct, wrong }: { exact: number; correct: number; wrong: number }) {
  const total = exact + correct + wrong;
  if (total === 0) return <div className="h-2 rounded-full bg-gray-800 w-full" />;
  const ep = (exact   / total) * 100;
  const cp = (correct / total) * 100;
  const wp = (wrong   / total) * 100;
  return (
    <div className="h-2 rounded-full overflow-hidden flex w-full">
      {ep > 0 && <div style={{ width: `${ep}%`, background: '#facc15' }} />}
      {cp > 0 && <div style={{ width: `${cp}%`, background: '#4ade80' }} />}
      {wp > 0 && <div style={{ width: `${wp}%`, background: '#f87171' }} />}
    </div>
  );
}

// Stat chip
function Chip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-gray-800/60">
      <span className={`text-base font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

interface Props {
  userId: number;
  username: string;
  onClose: () => void;
}

export default function UserBreakdownModal({ userId, username, onClose }: Props) {
  const [data, setData]       = useState<UserBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    leaderboardService.getBreakdown(userId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-700 shadow-2xl"
        style={{ background: 'linear-gradient(135deg, rgba(8,14,40,0.99) 0%, rgba(12,22,58,0.99) 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">{username}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Points breakdown</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-center text-red-400 py-8">Failed to load breakdown.</p>
          )}

          {data && (
            <>
              {/* ── Total summary chips ─────────────────────────────────── */}
              <div className="grid grid-cols-4 gap-2">
                <Chip label="Match pts"  value={data.totals.matchPoints}      color="text-white" />
                <Chip label="Round bonus" value={`+${data.totals.roundBonuses}`}    color="text-purple-400" />
                <Chip label="Unique ⭐"  value={`+${data.totals.uniqueExactBonus}`} color="text-yellow-400" />
                <Chip label="Total"       value={data.totals.totalPoints}      color="text-primary-300 text-lg" />
              </div>

              {/* ── Bonus breakdown bar ─────────────────────────────────── */}
              {data.totals.totalBonus > 0 && (() => {
                const total = data.totals.totalBonus;
                const rp = Math.round((data.totals.roundBonuses   / total) * 100);
                const up = Math.round((data.totals.uniqueExactBonus / total) * 100);
                const wp = 100 - rp - up;
                return (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">Bonus breakdown ({total} pts total)</p>
                    <div className="h-3 rounded-full overflow-hidden flex">
                      {rp > 0 && <div style={{ width: `${rp}%`, background: '#a855f7' }} title={`Round bonuses ${data.totals.roundBonuses}pts`} />}
                      {up > 0 && <div style={{ width: `${up}%`, background: '#facc15' }} title={`Unique exact ${data.totals.uniqueExactBonus}pts`} />}
                      {wp > 0 && <div style={{ width: `${wp}%`, background: '#374151' }} />}
                    </div>
                    <div className="flex gap-4 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Round bonuses ({data.totals.roundBonuses})</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Unique exact ({data.totals.uniqueExactBonus})</span>
                    </div>
                  </div>
                );
              })()}

              {/* ── Per matchday ────────────────────────────────────────── */}
              {data.matchdays.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800 pb-1.5">Group Stage — Per Matchday</p>
                  {data.matchdays.map(md => {
                    const total = md.exact + md.correct + md.wrong;
                    const hitPct = total > 0 ? Math.round(((md.exact + md.correct) / total) * 100) : 0;
                    const totalMdBonus = md.roundBonus + md.uniqueExactBonus;
                    const isComplete = md.finishedMatches === md.totalMatches && md.totalMatches > 0;
                    return (
                      <div key={md.round} className="rounded-xl border border-gray-800 p-3.5 space-y-3"
                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                        {/* Row 1: title + status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">Matchday {md.round}</span>
                            {!isComplete && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                {md.finishedMatches}/{md.totalMatches} played
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">{md.matchPoints} pts</span>
                            {totalMdBonus > 0 && (
                              <span className="text-purple-400 font-semibold">+{totalMdBonus} bonus</span>
                            )}
                            <span className="font-bold text-white">{md.matchPoints + totalMdBonus} total</span>
                          </div>
                        </div>

                        {/* Row 2: accuracy bar */}
                        <AccuracyBar exact={md.exact} correct={md.correct} wrong={md.wrong} />

                        {/* Row 3: stat counts */}
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <div className="flex gap-3">
                            <span className="text-yellow-400 font-semibold">⭐ {md.exact} exact</span>
                            <span className="text-green-400">✓ {md.correct} correct</span>
                            <span className="text-red-400">✗ {md.wrong} wrong</span>
                          </div>
                          <span className={hitPct >= 60 ? 'text-green-400' : hitPct >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                            {hitPct}% hit
                          </span>
                        </div>

                        {/* Row 4: bonus detail (only if any bonus) */}
                        {totalMdBonus > 0 && (
                          <div className="flex gap-3 text-[11px] pt-1 border-t border-gray-800">
                            {md.roundBonus > 0 && (
                              <span className="flex items-center gap-1 text-purple-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                                Round accuracy bonus: +{md.roundBonus}
                              </span>
                            )}
                            {md.uniqueExactBonus > 0 && (
                              <span className="flex items-center gap-1 text-yellow-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                                Unique exact: +{md.uniqueExactBonus}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Knockout breakdown ──────────────────────────────────── */}
              {data.knockout.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800 pb-1.5">Knockout Stage</p>
                  <div className="grid grid-cols-2 gap-2">
                    {data.knockout.map(ko => {
                      const total = ko.exact + ko.correct + ko.wrong;
                      const hitPct = total > 0 ? Math.round(((ko.exact + ko.correct) / total) * 100) : 0;
                      return (
                        <div key={ko.stage} className="rounded-lg border border-gray-800 p-3 space-y-2"
                          style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-300">{STAGE_LABEL[ko.stage] ?? ko.stage}</span>
                            <span className="text-xs text-white font-semibold">{ko.matchPoints} pts</span>
                          </div>
                          <AccuracyBar exact={ko.exact} correct={ko.correct} wrong={ko.wrong} />
                          <div className="flex gap-2 text-[10px] text-gray-500">
                            <span className="text-yellow-400">⭐{ko.exact}</span>
                            <span className="text-green-400">✓{ko.correct}</span>
                            <span className="text-red-400">✗{ko.wrong}</span>
                            {total > 0 && <span className="ml-auto text-gray-400">{hitPct}%</span>}
                          </div>
                          {ko.uniqueExactBonus > 0 && (
                            <p className="text-[10px] text-yellow-400">+{ko.uniqueExactBonus} unique</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
