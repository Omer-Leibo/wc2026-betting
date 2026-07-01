export interface SyncResult {
    matchesUpdated: number;
    newlyScored: number;
    teamsLinked: number;
    errors: string[];
}
export declare function linkTeams(): Promise<number>;
export declare function syncAllFixtures(): Promise<SyncResult>;
export declare function syncLiveFixtures(): Promise<SyncResult>;
export declare function getLastSync(): Promise<{
    error: string | null;
    id: number;
    syncedAt: Date;
    matchesUpdated: number;
    newlyScored: number;
} | null>;
export declare function syncPlayers(): Promise<number>;
//# sourceMappingURL=syncService.d.ts.map