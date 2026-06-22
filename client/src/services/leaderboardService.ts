import api from './api';
import type { LeaderboardEntry } from '../types';

export interface MatchdayBreakdown {
  round: number;
  totalMatches: number;
  finishedMatches: number;
  betCount: number;
  exact: number;
  correct: number;
  wrong: number;
  matchPoints: number;
  roundBonus: number;
  uniqueExactBonus: number;
}

export interface KnockoutBreakdown {
  stage: string;
  finishedMatches: number;
  betCount: number;
  exact: number;
  correct: number;
  wrong: number;
  matchPoints: number;
  uniqueExactBonus: number;
}

export interface UserBreakdown {
  userId: number;
  username: string;
  matchdays: MatchdayBreakdown[];
  knockout: KnockoutBreakdown[];
  totals: {
    matchPoints: number;
    roundBonuses: number;
    uniqueExactBonus: number;
    totalBonus: number;
    totalPoints: number;
  };
}

export interface RankSnapshotEntry {
  label: string;
  rank: number;
  totalPoints: number;
  createdAt: string;
}

export const leaderboardService = {
  async get(): Promise<{ entries: LeaderboardEntry[]; hasLiveGames: boolean; tournamentStarted: boolean }> {
    const { data } = await api.get<{ leaderboard: LeaderboardEntry[]; hasLiveGames: boolean; tournamentStarted: boolean }>('/leaderboard');
    return { entries: data.leaderboard, hasLiveGames: data.hasLiveGames, tournamentStarted: data.tournamentStarted ?? false };
  },

  async getHistory(): Promise<RankSnapshotEntry[]> {
    const { data } = await api.get<{ snapshots: RankSnapshotEntry[] }>('/leaderboard/history');
    return data.snapshots;
  },

  async getBreakdown(userId: number): Promise<UserBreakdown> {
    const { data } = await api.get<UserBreakdown>(`/leaderboard/${userId}/breakdown`);
    return data;
  },
};
