import api from './api';
import type { Match, Team } from '../types';

export const matchService = {
  async getAll(): Promise<Match[]> {
    const { data } = await api.get<{ matches: Match[] }>('/matches');
    return data.matches;
  },

  async getByStage(stage: string): Promise<Match[]> {
    const { data } = await api.get<{ matches: Match[] }>(`/matches/stage/${stage}`);
    return data.matches;
  },

  async getById(id: number): Promise<Match> {
    const { data } = await api.get<{ match: Match }>(`/matches/${id}`);
    return data.match;
  },

  async getTeams(): Promise<Team[]> {
    const { data } = await api.get<{ teams: Team[] }>('/matches/meta/teams');
    return data.teams;
  },

  async updateResult(id: number, homeScore: number, awayScore: number): Promise<Match> {
    const { data } = await api.patch<{ match: Match }>(`/matches/${id}/result`, { homeScore, awayScore });
    return data.match;
  },
};
