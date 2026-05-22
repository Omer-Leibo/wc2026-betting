import api from './api';
import type { LeaderboardEntry } from '../types';

export const leaderboardService = {
  async get(): Promise<LeaderboardEntry[]> {
    const { data } = await api.get<{ leaderboard: LeaderboardEntry[] }>('/leaderboard');
    return data.leaderboard;
  },
};
