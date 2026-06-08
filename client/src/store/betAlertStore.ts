import { create } from 'zustand';
import type { Match, MatchBet } from '../types';

interface BetAlertState {
  unbettedCount: number;
  nextUnbettedMatch: Match | null;
  /** Call this whenever matches + bets are freshly loaded on any page. */
  update: (matches: Match[], bets: MatchBet[]) => void;
}

export const useBetAlertStore = create<BetAlertState>((set) => ({
  unbettedCount: 0,
  nextUnbettedMatch: null,
  update: (matches, bets) => {
    const bettedIds = new Set(bets.map(b => b.matchId));
    const upcoming = matches
      .filter(m => m.status === 'UPCOMING' && !bettedIds.has(m.id))
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
    set({
      unbettedCount: upcoming.length,
      nextUnbettedMatch: upcoming[0] ?? null,
    });
  },
}));
