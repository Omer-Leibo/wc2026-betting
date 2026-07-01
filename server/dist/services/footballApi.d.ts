export interface ApiFixture {
    fixture: {
        id: number;
        date: string;
        status: {
            short: string;
            elapsed: number | null;
        };
        venue: {
            name: string | null;
            city: string | null;
        };
    };
    league: {
        id: number;
        round: string;
    };
    teams: {
        home: {
            id: number;
            name: string;
            logo: string;
        };
        away: {
            id: number;
            name: string;
            logo: string;
        };
    };
    goals: {
        home: number | null;
        away: number | null;
    };
    score: {
        duration: string;
        fulltime: {
            home: number | null;
            away: number | null;
        };
        extratime: {
            home: number | null;
            away: number | null;
        };
        penalty: {
            home: number | null;
            away: number | null;
        };
        regularTime?: {
            home: number | null;
            away: number | null;
        };
    };
}
export interface ApiTeam {
    team: {
        id: number;
        name: string;
        code: string;
        logo: string;
    };
    venue: {
        name: string;
    };
}
/** Fetch fixtures for the active competition.
 *  For WC: all matches (104).
 *  For test competitions (SA, PL, etc.): only from today onwards so we don't
 *  flood the DB with a full season of historical matches. */
export declare function fetchAllFixtures(): Promise<ApiFixture[]>;
/**
 * Fetch today's matches that are live or already finished.
 * 1 request per poll — very quota-friendly.
 */
export declare function fetchLiveFixtures(): Promise<ApiFixture[]>;
/** Fetch all teams registered for the active competition */
export declare function fetchTeams(): Promise<ApiTeam[]>;
/**
 * Fetch all WC 2026 teams INCLUDING their full squad.
 * Uses the /competitions/WC/teams endpoint which returns squad arrays.
 * 1 API call covers all 48 teams.
 */
export interface ApiSquadPlayer {
    id: number;
    name: string;
    position: string | null;
}
export interface ApiTeamWithSquad extends ApiTeam {
    squad: ApiSquadPlayer[];
}
export declare function fetchAllSquads(): Promise<ApiTeamWithSquad[]>;
/**
 * football-data.org doesn't expose a quota endpoint.
 * Free plan: 10 req/min (no daily cap).
 * Returns a placeholder so the Admin sync panel still renders.
 */
export declare function fetchQuota(): Promise<{
    current: number;
    limit: number;
}>;
/** Map short status code → our MatchStatus */
export declare function mapStatus(apiStatus: string): 'UPCOMING' | 'LIVE' | 'FINISHED';
/** Map round string → our Stage enum + groupRound */
export declare function mapStage(round: string): {
    stage: string;
    groupRound: number | null;
};
/**
 * football-data.org team names vs our seeded names.
 * Add entries here after the first sync if any names don't match.
 */
export declare const TEAM_NAME_ALIASES: Record<string, string>;
export declare function normaliseTeamName(apiName: string): string;
//# sourceMappingURL=footballApi.d.ts.map