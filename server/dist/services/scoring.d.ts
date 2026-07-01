export declare function scoreMatch(matchId: number): Promise<void>;
export declare function scoreGroupRoundBonuses(groupRound: number): Promise<void>;
export declare function takeLeaderboardSnapshot(label: string): Promise<void>;
export declare function scoreSpecialBets(type: 'CHAMPION' | 'TOP_SCORER' | 'TOP_ASSISTS', winnerTeamId?: number, winnerPlayerName?: string): Promise<void>;
export declare function getLeaderboard(requestingUserId?: number): Promise<{
    entries: {
        userId: number;
        username: string;
        matchPoints: number;
        specialPoints: number;
        bonusPoints: number;
        totalPoints: number;
        provisionalPoints: number;
        provisionalBonusPoints: number;
        exactScores: number;
        correctScores: number;
        specialBetDetails: {
            champion: {
                name: string;
                pointsAwarded: number | null;
            } | null;
            topScorer: {
                name: string;
                pointsAwarded: number | null;
            } | null;
            topAssists: {
                name: string;
                pointsAwarded: number | null;
            } | null;
        } | null;
        rank: number;
    }[];
    hasLiveGames: boolean;
    tournamentStarted: boolean;
}>;
//# sourceMappingURL=scoring.d.ts.map