import api from './api';
import type { Match } from '../types';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  _count: { matchBets: number; specialBets: number };
}

export interface AdminStats {
  userCount: number;
  matchCount: number;
  finishedCount: number;
  betCount: number;
}

export const adminService = {
  async getUsers(): Promise<AdminUser[]> {
    const { data } = await api.get<{ users: AdminUser[] }>('/admin/users');
    return data.users;
  },

  async deleteUser(id: number): Promise<void> {
    await api.delete(`/admin/users/${id}`);
  },

  async updateUserRole(id: number, role: 'USER' | 'ADMIN'): Promise<void> {
    await api.patch(`/admin/users/${id}/role`, { role });
  },

  async getPendingMatches(): Promise<Match[]> {
    const { data } = await api.get<{ matches: Match[] }>('/admin/matches/pending');
    return data.matches;
  },

  async getMatchBets(matchId: number) {
    const { data } = await api.get(`/admin/matches/${matchId}/bets`);
    return data.bets;
  },

  async setMatchResult(matchId: number, homeScore: number, awayScore: number): Promise<Match> {
    const { data } = await api.patch<{ match: Match }>(`/matches/${matchId}/result`, { homeScore, awayScore });
    return data.match;
  },

  async scoreSpecialBets(type: 'CHAMPION' | 'TOP_SCORER' | 'TOP_ASSISTS', winnerTeamId?: number, winnerPlayerName?: string): Promise<void> {
    await api.post('/admin/special-results', { type, winnerTeamId, winnerPlayerName });
  },

  async getStats(): Promise<AdminStats> {
    const { data } = await api.get<{ stats: AdminStats }>('/admin/stats');
    return data.stats;
  },
};
