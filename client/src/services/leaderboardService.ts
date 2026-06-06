import api from './api';
import type { LeaderboardEntry } from '../types';

export const leaderboardService = {
  async get(): Promise<{ entries: LeaderboardEntry[]; hasLiveGames: boolean }> {
    const { data } = await api.get<{ leaderboard: LeaderboardEntry[]; hasLiveGames: boolean }>('/leaderboard');
    return { entries: data.leaderboard, hasLiveGames: data.hasLiveGames };
  },
};
