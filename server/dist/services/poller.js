"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPoller = startPoller;
exports.stopPoller = stopPoller;
const prisma_1 = require("../lib/prisma");
const syncService_1 = require("./syncService");
const pushService_1 = require("./pushService");
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 min — no live games
const LIVE_INTERVAL_MS = 60 * 1000; // 1 min — during live games
const PRE_TOURNAMENT_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 h — once-daily before tournament
// WC 2026 date window — only poll live during the tournament.
// In test mode (FOOTBALL_API_COMPETITION set to something other than WC),
// the date restriction is bypassed so you can test with live games today.
const TOURNAMENT_START = new Date('2026-06-11T00:00:00Z');
const TOURNAMENT_END = new Date('2026-07-20T00:00:00Z');
let pollerHandle = null;
let lastPreTournamentSync = null; // track daily pre-tournament syncs
function isTournamentActive() {
    const testMode = process.env.FOOTBALL_API_COMPETITION &&
        process.env.FOOTBALL_API_COMPETITION !== 'WC';
    if (testMode)
        return true;
    const now = new Date();
    return now >= TOURNAMENT_START && now <= TOURNAMENT_END;
}
async function hasLiveMatches() {
    const count = await prisma_1.prisma.match.count({ where: { status: 'LIVE' } });
    return count > 0;
}
/** Single poll tick — runs sync, then schedules the next tick adaptively. */
async function pollTick() {
    if (!isTournamentActive()) {
        // Once-daily full sync to keep squads and schedule up to date before the tournament
        const now = new Date();
        const needsSync = !lastPreTournamentSync ||
            now.getTime() - lastPreTournamentSync.getTime() >= PRE_TOURNAMENT_SYNC_INTERVAL;
        if (needsSync) {
            console.log('[Poller] Pre-tournament daily sync — updating fixtures & squads...');
            try {
                const result = await (0, syncService_1.syncAllFixtures)();
                lastPreTournamentSync = now;
                console.log(`[Poller] Pre-tournament sync done: ${result.matchesUpdated} matches, ` +
                    `${result.teamsLinked} teams linked`);
                if (result.errors.length)
                    console.warn('[Poller] Sync warnings:', result.errors);
            }
            catch (err) {
                console.error('[Poller] Pre-tournament daily sync failed:', err);
            }
        }
        pollerHandle = setTimeout(pollTick, DEFAULT_INTERVAL_MS);
        return;
    }
    try {
        const result = await (0, syncService_1.syncLiveFixtures)();
        if (result.matchesUpdated > 0 || result.newlyScored > 0) {
            console.log(`[Poller] Live sync: ${result.matchesUpdated} updated, ${result.newlyScored} newly scored`);
        }
    }
    catch (err) {
        console.error('[Poller] Live sync error:', err);
    }
    // Send push reminders to users who haven't bet on matches starting in ~60 min
    (0, pushService_1.sendBetReminders)().catch(err => console.error('[Poller] Push reminders error:', err));
    // Choose next interval based on whether live games are happening right now
    const live = await hasLiveMatches();
    const nextMs = live ? LIVE_INTERVAL_MS : DEFAULT_INTERVAL_MS;
    pollerHandle = setTimeout(pollTick, nextMs);
}
async function startPoller() {
    if (!process.env.FOOTBALL_API_KEY || process.env.FOOTBALL_API_KEY === 'your_football_data_key_here') {
        console.log('[Poller] FOOTBALL_API_KEY not set — live sync disabled.');
        console.log('[Poller] Register free at https://www.football-data.org/client/register then add key to .env');
        return;
    }
    // Do an initial full sync on startup and mark it as the first pre-tournament sync
    console.log('[Poller] Running initial full sync...');
    try {
        const result = await (0, syncService_1.syncAllFixtures)();
        lastPreTournamentSync = new Date(); // don't repeat within the next 24 h
        console.log(`[Poller] Initial sync complete: ${result.matchesUpdated} matches updated, ${result.newlyScored} scored, ${result.teamsLinked} teams linked`);
        if (result.errors.length)
            console.warn('[Poller] Sync warnings:', result.errors);
    }
    catch (err) {
        console.error('[Poller] Initial sync failed:', err);
    }
    // Start adaptive polling
    const live = await hasLiveMatches();
    const firstInterval = live ? LIVE_INTERVAL_MS : DEFAULT_INTERVAL_MS;
    pollerHandle = setTimeout(pollTick, firstInterval);
    if (isTournamentActive()) {
        console.log(`[Poller] Auto-sync started — ${LIVE_INTERVAL_MS / 1000}s during live games / ${DEFAULT_INTERVAL_MS / 1000}s when idle`);
    }
    else {
        console.log(`[Poller] Pre-tournament mode — daily full sync every 24 h, checking every ${DEFAULT_INTERVAL_MS / 1000 / 60} min`);
    }
}
function stopPoller() {
    if (pollerHandle) {
        clearTimeout(pollerHandle);
        pollerHandle = null;
        console.log('[Poller] Stopped');
    }
}
//# sourceMappingURL=poller.js.map