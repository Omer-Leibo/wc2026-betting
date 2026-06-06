import { useLang } from '../i18n/LanguageContext';

export default function RulesPage() {
  const { t } = useLang();

  const scoringRows = [
    { stage: t.matchCard.groupStage, winner: 1,  exact: 3 },
    { stage: t.matchCard.roundOf32,  winner: 2,  exact: 4 },
    { stage: t.matchCard.roundOf16,  winner: 2,  exact: 4 },
    { stage: t.matchCard.quarterFinal, winner: 2, exact: 4 },
    { stage: t.matchCard.semiFinal,  winner: 3,  exact: 5 },
    { stage: t.matchCard.thirdPlace, winner: 3,  exact: 5 },
    { stage: t.matchCard.final,      winner: 3,  exact: 5 },
  ];

  const accuracyRows = [
    { label: `23 – 24 ${t.rules.correct}`, pts: 4 },
    { label: `21 – 22 ${t.rules.correct}`, pts: 3 },
    { label: `18 – 20 ${t.rules.correct}`, pts: 2 },
    { label: `${t.rules.below}18`,         pts: 0 },
  ];

  const exactRows = [
    { label: `24 / 24 ${t.rules.exactWord}`, pts: 5 },
    { label: `18 – 23 ${t.rules.exactWord}`, pts: 4 },
    { label: `12 – 17 ${t.rules.exactWord}`, pts: 3 },
    { label: `${t.rules.below}12`,           pts: 0 },
  ];

  const specialRows = [
    { emoji: '🏆', label: t.specialBets.champion.replace('🏆 ', ''),   desc: t.specialBets.championDesc,   pts: 5 },
    { emoji: '⚽', label: t.specialBets.topScorer.replace('⚽ ', ''),   desc: t.specialBets.topScorerDesc,  pts: 4 },
    { emoji: '🎯', label: t.specialBets.topAssists.replace('🎯 ', ''),  desc: t.specialBets.topAssistsDesc, pts: 3 },
  ];

  const totalRows = [
    { label: t.rules.matchPointsLabel,   color: 'text-green-400',   desc: t.rules.matchPointsDesc },
    { label: t.rules.bonusPointsLabel,   color: 'text-purple-400',  desc: t.rules.bonusPointsDesc },
    { label: t.rules.specialPointsLabel, color: 'text-primary-400', desc: t.rules.specialPointsDesc },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t.rules.title}</h1>
        <p className="text-gray-400 mt-1 text-sm">{t.rules.subtitle}</p>
      </div>

      {/* ── Match Bets ───────────────────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          {t.rules.matchBetsTitle}
        </h2>
        <p className="text-gray-400 text-sm">{t.rules.matchBetsDesc}</p>

        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700">
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">{t.rules.tableStage}</th>
                <th className="px-4 py-2.5 text-center text-gray-400 font-medium">{t.rules.tableCorrect}</th>
                <th className="px-4 py-2.5 text-center text-gray-400 font-medium">{t.rules.tableExact}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {scoringRows.map(row => (
                <tr key={row.stage} className="hover:bg-gray-800/40">
                  <td className="px-4 py-2.5 text-white font-medium">{row.stage}</td>
                  <td className="px-4 py-2.5 text-center text-green-400 font-semibold">
                    +{row.winner} {row.winner > 1 ? t.rules.pts : t.rules.pt}
                  </td>
                  <td className="px-4 py-2.5 text-center text-yellow-400 font-semibold">
                    +{row.exact} {t.rules.pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-green-400 font-semibold shrink-0">{t.rules.correctLabel}</span>
            <span className="text-gray-400">{t.rules.correctDesc}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-yellow-400 font-semibold shrink-0">{t.rules.exactLabel}</span>
            <span className="text-gray-400">{t.rules.exactDesc}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400 font-semibold shrink-0">{t.rules.uniqueLabel}</span>
            <span className="text-gray-400">{t.rules.uniqueDesc}</span>
          </div>
        </div>
      </section>

      {/* ── Betting Deadlines ─────────────────────────────────────────────────── */}
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          {t.rules.deadlinesTitle}
        </h2>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex gap-2">
            <span className="text-red-400 shrink-0">•</span>
            <span>{t.rules.matchBetsLock}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-red-400 shrink-0">•</span>
            <span>{t.rules.specialBetsLock}</span>
          </li>
        </ul>
      </section>

      {/* ── Group Stage Bonuses ───────────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          {t.rules.groupBonusTitle}
        </h2>
        <p className="text-gray-400 text-sm">{t.rules.groupBonusDesc}</p>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Accuracy ladder */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{t.rules.accuracyTitle}</h3>
            <p className="text-xs text-gray-500">{t.rules.accuracyDesc}</p>
            <div className="space-y-1">
              {accuracyRows.map(r => (
                <div key={r.label} className="flex justify-between items-center bg-gray-800 rounded px-3 py-1.5 text-sm">
                  <span className="text-gray-300">{r.label}</span>
                  <span className={r.pts > 0 ? 'text-purple-400 font-bold' : 'text-gray-600'}>
                    {r.pts > 0 ? `+${r.pts} ${t.rules.pts}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Exact ladder */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{t.rules.exactBonusTitle}</h3>
            <p className="text-xs text-gray-500">{t.rules.exactBonusDesc}</p>
            <div className="space-y-1">
              {exactRows.map(r => (
                <div key={r.label} className="flex justify-between items-center bg-gray-800 rounded px-3 py-1.5 text-sm">
                  <span className="text-gray-300">{r.label}</span>
                  <span className={r.pts > 0 ? 'text-purple-400 font-bold' : 'text-gray-600'}>
                    {r.pts > 0 ? `+${r.pts} ${t.rules.pts}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500">{t.rules.bothNote}</p>
      </section>

      {/* ── Special Bets ─────────────────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          {t.rules.specialTitle}
        </h2>
        <p className="text-gray-400 text-sm">{t.rules.specialDesc}</p>

        <div className="space-y-2">
          {specialRows.map(b => (
            <div key={b.label} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{b.emoji}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{b.label}</p>
                  <p className="text-gray-400 text-xs">{b.desc}</p>
                </div>
              </div>
              <span className="text-primary-400 font-bold text-lg shrink-0 ml-4">+{b.pts} {t.rules.pts}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How Points Add Up ─────────────────────────────────────────────────── */}
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          {t.rules.totalTitle}
        </h2>
        <div className="space-y-2 text-sm">
          {totalRows.map(row => (
            <div key={row.label} className="flex gap-3 items-start bg-gray-800 rounded-lg px-4 py-3">
              <span className={`${row.color} font-semibold w-32 shrink-0`}>{row.label}</span>
              <span className="text-gray-400">{row.desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 pt-1">
          <strong className="text-gray-400">{t.rules.totalFormula}</strong>{' '}
          {t.rules.liveUpdate}
        </p>
      </section>

      {/* ── Tips ─────────────────────────────────────────────────────────────── */}
      <section className="card space-y-3 border-primary-800 bg-primary-950/20">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          {t.rules.tipsTitle}
        </h2>
        <ul className="space-y-2 text-sm text-gray-400">
          {[t.rules.tip1, t.rules.tip2, t.rules.tip3, t.rules.tip4, t.rules.tip5].map((tip, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary-400 shrink-0">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
