export default function RulesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">📋 Rules & Scoring</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Everything you need to know about how points are earned.
        </p>
      </div>

      {/* ── Match Bets ───────────────────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          📅 Match Bets
        </h2>
        <p className="text-gray-400 text-sm">
          For every match, predict the exact final score. Points are awarded based on how close you are.
        </p>

        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700">
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Stage</th>
                <th className="px-4 py-2.5 text-center text-gray-400 font-medium">✓ Correct result</th>
                <th className="px-4 py-2.5 text-center text-gray-400 font-medium">⭐ Exact score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[
                { stage: 'Group Stage',     winner: 1, exact: 3 },
                { stage: 'Round of 32',     winner: 2, exact: 4 },
                { stage: 'Round of 16',     winner: 2, exact: 4 },
                { stage: 'Quarter-finals',  winner: 2, exact: 4 },
                { stage: 'Semi-finals',     winner: 3, exact: 5 },
                { stage: '3rd Place Final', winner: 3, exact: 5 },
                { stage: 'Final',           winner: 3, exact: 5 },
              ].map(row => (
                <tr key={row.stage} className="hover:bg-gray-800/40">
                  <td className="px-4 py-2.5 text-white font-medium">{row.stage}</td>
                  <td className="px-4 py-2.5 text-center text-green-400 font-semibold">+{row.winner} pt{row.winner > 1 ? 's' : ''}</td>
                  <td className="px-4 py-2.5 text-center text-yellow-400 font-semibold">+{row.exact} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-green-400 font-semibold shrink-0">✓ Correct result</span>
            <span className="text-gray-400">— you got the right winner or correctly predicted a draw, but not the exact score.</span>
          </div>
          <div className="flex gap-2">
            <span className="text-yellow-400 font-semibold shrink-0">⭐ Exact score</span>
            <span className="text-gray-400">— you predicted the exact final scoreline (e.g. 2–1). Includes the correct result points.</span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400 font-semibold shrink-0">🎖 Unique exact bonus</span>
            <span className="text-gray-400">— if you're the <em>only</em> person who predicted the exact score for a match, you get an extra <strong className="text-white">+1 pt</strong> on top.</span>
          </div>
        </div>
      </section>

      {/* ── Betting Deadlines ─────────────────────────────────────────────────── */}
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          🔒 Betting Deadlines
        </h2>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex gap-2">
            <span className="text-red-400 shrink-0">•</span>
            <span><strong className="text-white">Match bets</strong> lock exactly <strong className="text-white">1 minute before kick-off</strong>. After that the score inputs disappear — no changes possible.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-red-400 shrink-0">•</span>
            <span><strong className="text-white">Special bets</strong> (Champion, Top Scorer, Top Assists) lock <strong className="text-white">1 minute before the first match of the tournament</strong>. Update them any time before then.</span>
          </li>
        </ul>
      </section>

      {/* ── Group Stage Bonuses ───────────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          🎯 Group Stage Bonus Points
        </h2>
        <p className="text-gray-400 text-sm">
          After <strong className="text-white">all 24 matches</strong> in a group stage matchday finish
          (Matchday 1, 2, or 3), bonus points are awarded based on your overall accuracy for that round.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Accuracy ladder */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Accuracy Bonus</h3>
            <p className="text-xs text-gray-500">How many results did you get right (correct or exact)?</p>
            <div className="space-y-1">
              {[
                { label: '23 – 24 correct', pts: 4 },
                { label: '21 – 22 correct', pts: 3 },
                { label: '18 – 20 correct', pts: 2 },
                { label: 'Below 18',        pts: 0 },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center bg-gray-800 rounded px-3 py-1.5 text-sm">
                  <span className="text-gray-300">{r.label}</span>
                  <span className={r.pts > 0 ? 'text-purple-400 font-bold' : 'text-gray-600'}>
                    {r.pts > 0 ? `+${r.pts} pts` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Exact ladder */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Exact Score Bonus</h3>
            <p className="text-xs text-gray-500">How many exact scorelines did you predict correctly?</p>
            <div className="space-y-1">
              {[
                { label: '24 / 24 exact', pts: 5 },
                { label: '18 – 23 exact', pts: 4 },
                { label: '12 – 17 exact', pts: 3 },
                { label: 'Below 12',      pts: 0 },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center bg-gray-800 rounded px-3 py-1.5 text-sm">
                  <span className="text-gray-300">{r.label}</span>
                  <span className={r.pts > 0 ? 'text-purple-400 font-bold' : 'text-gray-600'}>
                    {r.pts > 0 ? `+${r.pts} pts` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Both bonuses can be earned in the same matchday — they're independent of each other.
          Bonuses are recalculated automatically each time a match result is entered.
        </p>
      </section>

      {/* ── Special Bets ─────────────────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          ⭐ Special Bets
        </h2>
        <p className="text-gray-400 text-sm">
          One-time predictions for the tournament as a whole. Place or update them any time before the first kick-off.
        </p>

        <div className="space-y-2">
          {[
            { emoji: '🏆', label: 'Champion',   desc: 'Which team will win the World Cup?',   pts: 5 },
            { emoji: '⚽', label: 'Top Scorer',  desc: 'Who will score the most goals?',        pts: 4 },
            { emoji: '🎯', label: 'Top Assists', desc: 'Who will have the most assists?',        pts: 3 },
          ].map(b => (
            <div key={b.label} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{b.emoji}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{b.label}</p>
                  <p className="text-gray-400 text-xs">{b.desc}</p>
                </div>
              </div>
              <span className="text-primary-400 font-bold text-lg shrink-0 ml-4">+{b.pts} pts</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How Points Add Up ─────────────────────────────────────────────────── */}
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          🏅 How Your Total Score Is Calculated
        </h2>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Match points',   color: 'text-green-400',  desc: 'Points from all 104 match predictions combined' },
            { label: 'Bonus points',   color: 'text-purple-400', desc: 'Group stage accuracy & exact score ladder bonuses (up to 3 matchdays)' },
            { label: 'Special points', color: 'text-primary-400',desc: 'Points from Champion, Top Scorer, Top Assists predictions' },
          ].map(row => (
            <div key={row.label} className="flex gap-3 items-start bg-gray-800 rounded-lg px-4 py-3">
              <span className={`${row.color} font-semibold w-32 shrink-0`}>{row.label}</span>
              <span className="text-gray-400">{row.desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 pt-1">
          <strong className="text-gray-400">Total = Match points + Bonus points + Special points.</strong>{' '}
          The leaderboard updates live as match results are entered by the admin.
        </p>
      </section>

      {/* ── Tips ─────────────────────────────────────────────────────────────── */}
      <section className="card space-y-3 border-primary-800 bg-primary-950/20">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          💡 Tips
        </h2>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex gap-2"><span className="text-primary-400 shrink-0">•</span><span>Exact scores are worth significantly more — even a lucky 0–0 could swing the leaderboard.</span></li>
          <li className="flex gap-2"><span className="text-primary-400 shrink-0">•</span><span>Group stage bonuses reward consistency across all 24 games in a matchday — don't neglect the less exciting matches.</span></li>
          <li className="flex gap-2"><span className="text-primary-400 shrink-0">•</span><span>If you're the only person to predict an exact score, you get an extra bonus point — being contrarian pays off.</span></li>
          <li className="flex gap-2"><span className="text-primary-400 shrink-0">•</span><span>Special bets are small in points but free wins if you do your research before the tournament starts.</span></li>
          <li className="flex gap-2"><span className="text-primary-400 shrink-0">•</span><span>Check the <strong className="text-white">All Bets</strong> page once a game kicks off to see what everyone else predicted.</span></li>
        </ul>
      </section>

    </div>
  );
}
