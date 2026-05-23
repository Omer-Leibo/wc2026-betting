// ─── Auth ─────────────────────────────────────────────────────────────────────

export type Role = 'USER' | 'ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ─── Teams & Players ──────────────────────────────────────────────────────────

export interface Team {
  id: number;
  name: string;
  code: string;
  group: string;
  flagUrl?: string;
}

export interface Player {
  id: number;
  name: string;
  position?: string;
  teamId: number;
  team?: Team;
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export type Stage =
  | 'GROUP'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL';

export type MatchStatus = 'UPCOMING' | 'LIVE' | 'FINISHED';

export interface Match {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  stage: Stage;
  groupRound?: number;
  matchDate: string;
  venue?: string;
  homeScore?: number;
  awayScore?: number;
  status: MatchStatus;
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export interface MatchBet {
  id: number;
  userId: number;
  matchId: number;
  match?: Match;
  predictedHome: number;
  predictedAway: number;
  pointsAwarded?: number;
}

export type SpecialBetType = 'CHAMPION' | 'TOP_SCORER' | 'TOP_ASSISTS';

export interface SpecialBet {
  id: number;
  userId: number;
  type: SpecialBetType;
  teamId?: number;
  team?: Team;
  playerName?: string;
  pointsAwarded?: number;
}

// ─── All Bets ─────────────────────────────────────────────────────────────────

export interface UserBet {
  userId: number;
  username: string;
  predictedHome: number;
  predictedAway: number;
  pointsAwarded: number | null;
}

export interface MatchWithAllBets extends Match {
  bets: UserBet[];
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface SpecialBetDetail {
  name: string;
  pointsAwarded: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  totalPoints: number;
  matchPoints: number;
  specialPoints: number;
  bonusPoints: number;
  exactScores: number;
  correctScores: number;
  specialBetDetails: {
    champion:   SpecialBetDetail | null;
    topScorer:  SpecialBetDetail | null;
    topAssists: SpecialBetDetail | null;
  };
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
