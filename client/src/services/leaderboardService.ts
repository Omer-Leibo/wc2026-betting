import api from './api';
import type { LeaderboardEntry } from '../types';

export const leaderboardService = {
  async get(): Promise<{ entries: LeaderboardEntry[]; hasLiveGames: boolean; tournamentStarted: boolean }> {
    const { data } = await api.get<{ leaderboard: LeaderboardEntry[]; hasLiveGames: boolean; tournamentStarted: boolean }>('/leaderboard');
    return { entries: data.leaderboard, hasLiveGames: data.hasLiveGames, tournamentStarted: data.tournamentStarted ?? false };
  },
};
