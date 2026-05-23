import api from './api';
import type { MatchBet, MatchWithAllBets, SpecialBet, SpecialBetType } from '../types';

export const betService = {
  async getMyBets(): Promise<{ matchBets: MatchBet[]; specialBets: SpecialBet[] }> {
    const { data } = await api.get('/bets/my');
    return data;
  },

  async placeMatchBet(matchId: number, predictedHome: number, predictedAway: number): Promise<MatchBet> {
    const { data } = await api.post(`/bets/match/${matchId}`, { predictedHome, predictedAway });
    return data.bet;
  },

  async deleteMatchBet(matchId: number): Promise<void> {
    await api.delete(`/bets/match/${matchId}`);
  },

  async placeSpecialBet(type: SpecialBetType, payload: { teamId?: number; playerName?: string }): Promise<SpecialBet> {
    const { data } = await api.post('/bets/special', { type, ...payload });
    return data.bet;
  },

  async getMySpecialBets(): Promise<SpecialBet[]> {
    const { data } = await api.get('/bets/special/my');
    return data.specialBets;
  },

  async getAllBets(): Promise<MatchWithAllBets[]> {
    const { data } = await api.get<{ matches: MatchWithAllBets[] }>('/bets/all');
    return data.matches;
  },
};
