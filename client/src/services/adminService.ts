import api from './api';
import type { Match } from '../types';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  createdAt: string;
  _count: { matchBets: number; specialBets: number };
}

export interface SyncResult {
  matchesUpdated: number;
  newlyScored: number;
  teamsLinked: number;
  errors: string[];
}

export interface SyncStatus {
  lastSync: { syncedAt: string; matchesUpdated: number; newlyScored: number; error: string | null } | null;
  quota: { current: number; limit: number } | null;
}

export interface AdminStats {
  userCount: number;
  matchCount: number;
  finishedCount: number;
  betCount: number;
  lastSync?: SyncStatus['lastSync'];
}

export interface BackupMeta {
  filename: string;
  createdAt: string;
  sizeKb: number;
}

export const adminService = {
  async getUsers(): Promise<AdminUser[]> {
    const { data } = await api.get<{ users: AdminUser[] }>('/admin/users');
    return data.users;
  },

  async deleteUser(id: number): Promise<void> {
    await api.delete(`/admin/users/${id}`);
  },

  async resetUserPassword(id: number): Promise<string> {
    const { data } = await api.post<{ tempPassword: string }>(`/admin/users/${id}/reset-password`);
    return data.tempPassword;
  },

  async updateUserRole(id: number, role: 'USER' | 'ADMIN'): Promise<void> {
    await api.patch(`/admin/users/${id}/role`, { role });
  },

  async approveUser(id: number): Promise<void> {
    await api.patch(`/admin/users/${id}/status`, { status: 'ACTIVE' });
  },

  async rejectUser(id: number): Promise<void> {
    await api.patch(`/admin/users/${id}/status`, { status: 'REJECTED' });
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

  async rescoreMatch(matchId: number): Promise<void> {
    await api.post(`/admin/rescore-match/${matchId}`);
  },

  async rescoreGroupRound(round: 1 | 2 | 3): Promise<void> {
    await api.post('/admin/rescore-group-round', { round });
  },

  async takeSnapshot(label: string): Promise<void> {
    await api.post('/admin/take-snapshot', { label });
  },

  async getStats(): Promise<AdminStats> {
    const { data } = await api.get<{ stats: AdminStats }>('/admin/stats');
    return data.stats;
  },

  async syncAll(): Promise<SyncResult> {
    const { data } = await api.post<{ result: SyncResult }>('/admin/sync');
    return data.result;
  },

  async syncLive(): Promise<SyncResult> {
    const { data } = await api.post<{ result: SyncResult }>('/admin/sync/live');
    return data.result;
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const { data } = await api.get<SyncStatus>('/admin/sync/status');
    return data;
  },

  async syncPlayers(): Promise<number> {
    const { data } = await api.post<{ playersSync: number }>('/admin/sync/players');
    return data.playersSync;
  },

  async listBackups(): Promise<BackupMeta[]> {
    const { data } = await api.get<{ backups: BackupMeta[] }>('/admin/backups');
    return data.backups;
  },

  async triggerBackup(): Promise<void> {
    await api.post('/admin/backups');
  },

  async downloadBackup(filename: string): Promise<void> {
    const { data } = await api.get<Blob>(`/admin/backups/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
