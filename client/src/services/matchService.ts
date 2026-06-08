import api from './api';
import type { Match, Team, Player, TeamStanding } from '../types';

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

  async getPlayers(): Promise<Player[]> {
    const { data } = await api.get<{ players: Player[] }>('/matches/meta/players');
    return data.players;
  },

  async updateResult(id: number, homeScore: number, awayScore: number): Promise<Match> {
    const { data } = await api.patch<{ match: Match }>(`/matches/${id}/result`, { homeScore, awayScore });
    return data.match;
  },

  async getFirstKickoff(): Promise<string | null> {
    const { data } = await api.get<{ firstKickoff: string | null }>('/matches/meta/first-kickoff');
    return data.firstKickoff;
  },

  async getStandings(): Promise<Record<string, TeamStanding[]>> {
    const { data } = await api.get<{ standings: Record<string, TeamStanding[]> }>('/matches/standings');
    return data.standings;
  },

  async getBracket(): Promise<Match[]> {
    const { data } = await api.get<{ matches: Match[] }>('/matches/bracket');
    return data.matches;
  },
};
