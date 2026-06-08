import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { betService } from '../../services/betService';
import { useAuthStore } from '../../store/authStore';
import type { CompareData, CompareMatch, CompareBet } from '../../types';
import dayjs from 'dayjs';

// ─── helpers ─────────────────────────────────────────────────────────────────

function pointColor(pts: number | null) {
  if (pts === null) return 'text-gray-500';
  if (pts > 0) return 'text-green-400';
  return 'text-red-400';
}

function resultIcon(bet: CompareBet | null, match: CompareMatch) {
  if (!bet || match.status !== 'FINISHED') return null;
  const { predictedHome: ph, predictedAway: pa } = bet;
  const { homeScore: hs, awayScore: as_ } = match;
  if (hs === null || as_ === null) return null;
  if (ph === hs && pa === as_) return <span className="text-yellow-400 text-xs">⭐</span>;
  const predWin = ph > pa ? 'H' : ph < pa ? 'A' : 'D';
  const realWin = hs > as_ ? 'H' : hs < as_ ? 'A' : 'D';
  if (predWin === realWin) return <span className="text-green-400 text-xs">✓</span>;
  return <span className="text-red-400 text-xs">✗</span>;
}

type Filter = 'all' | 'differs';

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  opponentId: number;
  onClose: () => void;
}

export default function HeadToHeadModal({ opponentId, onClose }: Props) {
  const { user } = useAuthStore();
  const [data, setData]     = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    betService.compare(opponentId)
      .then(setData)
      .catch(() => toast.error('Failed to load comparison'))
      .finally(() => setLoading(false));
  }, [opponentId]);

  // Trap scroll on the page behind the modal
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── filtered matches ──────────────────────────────────────────────────────
  const matches = data?.matches ?? [];
  const visible = filter === 'differs'
    ? matches.filter(m => {
        const my = m.myBet;
        const th = m.theirBet;
        if (!my || !th) return true; // one side missing
        return my.predictedHome !== th.predictedHome || my.predictedAway !== th.predictedAway;
      })
    : matches;

  // ── summary stats ─────────────────────────────────────────────────────────
  const finished = matches.filter(m => m.status === 'FINISHED');

  function stats(getBet: (m: CompareMatch) => CompareBet | null) {
    let pts = 0, exact = 0, correct = 0;
    for (const m of finished) {
      const b = getBet(m);
      if (!b) continue;
      pts += b.pointsAwarded ?? 0;
      const { predictedHome: ph, predictedAway: pa } = b;
      const { homeScore: hs, awayScore: as_ } = m;
      if (hs === null || as_ === null) continue;
      if (ph === hs && pa === as_) { exact++; correct++; continue; }
      const predWin = ph > pa ? 'H' : ph < pa ? 'A' : 'D';
      const realWin = hs > as_ ? 'H' : hs < as_ ? 'A' : 'D';
      if (predWin === realWin) correct++;
    }
    return { pts, exact, correct };
  }

  const myStat   = stats(m => m.myBet);
  const theirStat = stats(m => m.theirBet);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 pt-6"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{
          background: '#0d1526',
          border: '1px solid rgba(42,57,141,0.5)',
          maxHeight: '90vh',
        }}
      >
        {/* ── header ───────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'rgba(42,57,141,0.4)' }}
        >
          <h2 className="font-bold text-base flex items-center gap-2">
            <span>⚔️</span>
            <span className="text-primary-300">{user?.username}</span>
            <span className="text-gray-500 text-sm">vs</span>
            <span className="text-white">{data?.opponent?.username ?? '…'}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none w-7 h-7 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? null : (
          <>
            {/* ── summary bar ────────────────────────────────────────────── */}
            <div
              className="grid grid-cols-3 gap-0 shrink-0"
              style={{ borderBottom: '1px solid rgba(42,57,141,0.3)' }}
            >
              {(
                [
                  { label: 'Points', myVal: myStat.pts,     theirVal: theirStat.pts     },
                  { label: '⭐ Exact', myVal: myStat.exact,   theirVal: theirStat.exact   },
                  { label: '✓ Correct', myVal: myStat.correct, theirVal: theirStat.correct },
                ] as const
              ).map(({ label, myVal, theirVal }) => {
                const myWins    = myVal > theirVal;
                const theyWin   = theirVal > myVal;
                return (
                  <div key={label} className="flex flex-col items-center py-3 px-2 gap-1">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${myWins ? 'text-green-400' : theyWin ? 'text-gray-400' : 'text-white'}`}>
                        {myVal}
                      </span>
                      <span className="text-gray-600 text-xs">:</span>
                      <span className={`text-lg font-bold ${theyWin ? 'text-green-400' : myWins ? 'text-gray-400' : 'text-white'}`}>
                        {theirVal}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600">{finished.length} played</p>
                  </div>
                );
              })}
            </div>

            {/* ── filters ────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(42,57,141,0.2)' }}>
              {(['all', 'differs'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filter === f
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {f === 'all'     ? `All (${matches.length})`
                   : `Different Picks (${matches.filter(m => {
                      const my = m.myBet; const th = m.theirBet;
                      if (!my || !th) return true;
                      return my.predictedHome !== th.predictedHome || my.predictedAway !== th.predictedAway;
                    }).length})`}
                </button>
              ))}
            </div>

            {/* ── match list ─────────────────────────────────────────────── */}
            <div className="overflow-y-auto flex-1 px-2 py-2 space-y-1.5">
              {visible.length === 0 && (
                <p className="text-center text-gray-500 py-8 text-sm">No matches to show</p>
              )}
              {visible.map(m => {
                const isFinished = m.status === 'FINISHED';
                const isLive     = m.status === 'LIVE';

                return (
                  <div
                    key={m.id}
                    className="rounded-xl px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    {/* match info row */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-gray-500 font-medium">
                        {dayjs(m.matchDate).format('D MMM · HH:mm')}
                        {isLive && (
                          <span className="ml-1.5 text-green-400 animate-pulse">● LIVE</span>
                        )}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {m.homeTeam.code} vs {m.awayTeam.code}
                      </span>
                    </div>

                    {/* predictions row */}
                    <div className="grid grid-cols-3 items-center gap-2">
                      {/* my bet */}
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className={`text-sm font-bold tabular-nums ${
                          m.myBet ? 'text-white' : 'text-gray-600 italic'
                        }`}>
                          {m.myBet ? `${m.myBet.predictedHome}–${m.myBet.predictedAway}` : 'no bet'}
                        </span>
                        {resultIcon(m.myBet, m)}
                        {isFinished && m.myBet?.pointsAwarded !== undefined && m.myBet?.pointsAwarded !== null && (
                          <span className={`text-[10px] font-semibold tabular-nums ${pointColor(m.myBet.pointsAwarded)}`}>
                            +{m.myBet.pointsAwarded}
                          </span>
                        )}
                      </div>

                      {/* actual score */}
                      <div className="text-center">
                        {isFinished || isLive ? (
                          <span className={`text-sm font-bold tabular-nums ${isLive ? 'text-green-400' : 'text-gray-300'}`}>
                            {m.homeScore ?? '?'}–{m.awayScore ?? '?'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">vs</span>
                        )}
                      </div>

                      {/* their bet */}
                      <div className="flex items-center gap-1.5">
                        {resultIcon(m.theirBet, m)}
                        {isFinished && m.theirBet?.pointsAwarded !== undefined && m.theirBet?.pointsAwarded !== null && (
                          <span className={`text-[10px] font-semibold tabular-nums ${pointColor(m.theirBet.pointsAwarded)}`}>
                            +{m.theirBet.pointsAwarded}
                          </span>
                        )}
                        <span className={`text-sm font-bold tabular-nums ${
                          m.theirBet ? 'text-white' : 'text-gray-600 italic'
                        }`}>
                          {m.theirBet ? `${m.theirBet.predictedHome}–${m.theirBet.predictedAway}` : 'no bet'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── column labels ──────────────────────────────────────────── */}
            <div
              className="grid grid-cols-3 text-center px-3 py-1.5 text-[10px] text-gray-600 font-medium shrink-0"
              style={{ borderTop: '1px solid rgba(42,57,141,0.2)' }}
            >
              <span className="text-right pr-2">{user?.username}</span>
              <span>Score</span>
              <span className="text-left pl-2">{data.opponent.username}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
