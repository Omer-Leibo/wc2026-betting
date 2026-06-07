import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { matchService } from '../services/matchService';
import { betService } from '../services/betService';
import MatchCard from '../components/matches/MatchCard';
import { useLang } from '../i18n/LanguageContext';
import type { Match, MatchBet } from '../types';

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

type View = 'ALL' | 'GROUP' | 'KNOCKOUT';

// Section key — language-independent
function sectionKey(match: Match): string {
  if (match.stage === 'GROUP') return `GROUP_${match.groupRound ?? 1}`;
  return match.stage;
}

const KNOCKOUT_SECTION_ORDER = ['ROUND_OF_32','ROUND_OF_16','QUARTER_FINAL','SEMI_FINAL','THIRD_PLACE','FINAL'];

export default function MatchesPage() {
  const { t } = useLang();
  const [matches, setMatches]         = useState<Match[]>([]);
  const [bets, setBets]               = useState<MatchBet[]>([]);
  const [loading, setLoading]         = useState(true);
  const [view, setView]               = useState<View>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('A');

  const loadData = useCallback(async () => {
    const [m, b] = await Promise.all([matchService.getAll(), betService.getMyBets()]);
    setMatches(m);
    setBets(b.matchBets);
  }, []);

  useEffect(() => {
    loadData()
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, [loadData]);

  // Poll every 60 s while any match is live so scores stay current
  const hasLiveMatches = matches.some(m => m.status === 'LIVE');
  useEffect(() => {
    if (!hasLiveMatches) return;
    const timer = setInterval(() => loadData().catch(() => {}), 60_000);
    return () => clearInterval(timer);
  }, [hasLiveMatches, loadData]);

  // Translated knockout labels (reactive to language)
  const KNOCKOUT_LABELS: Record<string, string> = {
    ROUND_OF_32:   t.matches.roundOf32,
    ROUND_OF_16:   t.matches.roundOf16,
    QUARTER_FINAL: t.matches.quarterFinal,
    SEMI_FINAL:    t.matches.semiFinal,
    THIRD_PLACE:   t.matches.thirdPlace,
    FINAL:         t.matches.final,
  };

  function getSectionLabel(key: string): string {
    if (key.startsWith('GROUP_')) {
      const md = key.replace('GROUP_', '');
      return `🟢 ${t.matches.matchday} ${md}`;
    }
    return KNOCKOUT_LABELS[key] ?? key;
  }

  const betByMatchId = Object.fromEntries(bets.map(b => [b.matchId, b]));

  const handleBetSaved = (bet: MatchBet) => {
    setBets(prev => {
      const exists = prev.find(b => b.matchId === bet.matchId);
      return exists ? prev.map(b => b.matchId === bet.matchId ? bet : b) : [...prev, bet];
    });
  };

  // ── Derived lists ─────────────────────────────────────────────────────────

  const groupMatches    = matches.filter(m => m.stage === 'GROUP' && m.homeTeam.group === selectedGroup);
  const knockoutMatches = matches.filter(m => m.stage !== 'GROUP').sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
  );

  // All games: sorted by date, grouped into sections
  const allSorted = [...matches].sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
  );

  const groupKeys = [...new Set(allSorted.filter(m => m.stage === 'GROUP').map(sectionKey))]
    .sort((a, b) => (parseInt(a.replace('GROUP_', '')) || 0) - (parseInt(b.replace('GROUP_', '')) || 0));
  const knockoutKeys = KNOCKOUT_SECTION_ORDER.filter(k =>
    allSorted.some(m => sectionKey(m) === k)
  );
  const dynamicSectionOrder = [...groupKeys, ...knockoutKeys];

  const sections: { key: string; label: string; matches: Match[] }[] = [];
  for (const key of dynamicSectionOrder) {
    const sMatches = allSorted.filter(m => sectionKey(m) === key);
    if (sMatches.length > 0) {
      sections.push({ key, label: getSectionLabel(key), matches: sMatches });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.matches.title}</h1>
        <p className="text-sm text-gray-400">{bets.length} {t.matches.betsPlaced}</p>
      </div>

      {/* View selector */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL','GROUP','KNOCKOUT'] as View[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg font-heading font-bold text-base tracking-wide transition-colors ${view === v ? 'bg-primary-600 text-white' : 'bg-gray-800/80 text-gray-400 hover:text-white'}`}>
            {v === 'ALL' ? t.matches.allGames : v === 'GROUP' ? t.matches.byGroup : t.matches.knockout}
          </button>
        ))}
      </div>

      {/* ── ALL GAMES ─────────────────────────────────────────────────────── */}
      {view === 'ALL' && (
        <div className="space-y-8">
          {sections.length === 0 ? (
            <p className="text-gray-500">{t.matches.noMatches}</p>
          ) : (
            sections.map(({ key, label, matches: sMatches }) => (
              <div key={key} className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider border-b border-gray-800 pb-2">
                  {label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sMatches.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      bet={betByMatchId[match.id]}
                      onBetSaved={handleBetSaved}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── BY GROUP ──────────────────────────────────────────────────────── */}
      {view === 'GROUP' && (
        <>
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => (
              <button key={g} onClick={() => setSelectedGroup(g)}
                className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${selectedGroup === g ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {g}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-300">{t.matches.group} {selectedGroup}</h2>
            {groupMatches.length === 0 ? (
              <p className="text-gray-500">{t.matches.noMatches}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    bet={betByMatchId[match.id]}
                    onBetSaved={handleBetSaved}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── KNOCKOUT ──────────────────────────────────────────────────────── */}
      {view === 'KNOCKOUT' && (
        <div className="space-y-3">
          {knockoutMatches.length === 0 ? (
            <p className="text-gray-500">{t.matches.noMatches}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {knockoutMatches.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  bet={betByMatchId[match.id]}
                  onBetSaved={handleBetSaved}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
