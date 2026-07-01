export declare function initWebPush(): void;
export declare function isPushEnabled(): boolean;
export declare function sendNotification(userId: number, title: string, body: string, url?: string): Promise<void>;
/**
 * Called by the poller on every tick.
 * Sends a push notification to any subscriber who hasn't bet yet on a match
 * that kicks off in ~60 minutes.
 */
export declare function sendBetReminders(): Promise<void>;
//# sourceMappingURL=pushService.d.ts.map