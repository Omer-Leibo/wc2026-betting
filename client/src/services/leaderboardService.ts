import api from './api';
import type { LeaderboardEntry } from '../types';

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
};
