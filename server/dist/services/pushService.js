"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWebPush = initWebPush;
exports.isPushEnabled = isPushEnabled;
exports.sendNotification = sendNotification;
exports.sendBetReminders = sendBetReminders;
const web_push_1 = __importDefault(require("web-push"));
const prisma_1 = require("../lib/prisma");
// ─── VAPID init ───────────────────────────────────────────────────────────────
let pushEnabled = false;
function initWebPush() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
    if (!publicKey || !privateKey) {
        console.log('[Push] VAPID keys not set — push notifications disabled.');
        console.log('[Push] Run: node server/scripts/generate-vapid-keys.mjs');
        return;
    }
    web_push_1.default.setVapidDetails(subject, publicKey, privateKey);
    pushEnabled = true;
    console.log('[Push] Web Push ready.');
}
function isPushEnabled() {
    return pushEnabled;
}
// ─── Send to one user ─────────────────────────────────────────────────────────
async function sendNotification(userId, title, body, url = '/') {
    if (!pushEnabled)
        return;
    const subs = await prisma_1.prisma.pushSubscription.findMany({ where: { userId } });
    if (!subs.length)
        return;
    const payload = JSON.stringify({ title, body, url });
    for (const sub of subs) {
        try {
            await web_push_1.default.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        }
        catch (err) {
            // 410 Gone → subscription expired; clean up
            if (err.statusCode === 410 || err.statusCode === 404) {
                await prisma_1.prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } })
                    .catch(() => { });
            }
            else {
                console.error('[Push] sendNotification error for endpoint', sub.endpoint.slice(-12), err.statusCode);
            }
        }
    }
}
// ─── Bet reminders ────────────────────────────────────────────────────────────
// Keeps track of which match IDs we've already reminded about this session
// (resets on server restart — a minor dupe risk that's acceptable)
const remindedMatchIds = new Set();
/**
 * Called by the poller on every tick.
 * Sends a push notification to any subscriber who hasn't bet yet on a match
 * that kicks off in ~60 minutes.
 */
async function sendBetReminders() {
    if (!pushEnabled)
        return;
    const now = new Date();
    const windowStart = new Date(now.getTime() + 55 * 60 * 1000); // 55 min from now
    const windowEnd = new Date(now.getTime() + 65 * 60 * 1000); // 65 min from now
    const upcomingMatches = await prisma_1.prisma.match.findMany({
        where: {
            status: 'UPCOMING',
            matchDate: { gte: windowStart, lte: windowEnd },
        },
        include: { homeTeam: true, awayTeam: true },
    });
    for (const match of upcomingMatches) {
        if (remindedMatchIds.has(match.id))
            continue;
        remindedMatchIds.add(match.id);
        // Users who already have a bet on this match
        const alreadyBet = await prisma_1.prisma.matchBet.findMany({
            where: { matchId: match.id },
            select: { userId: true },
        });
        const bettedIds = new Set(alreadyBet.map(b => b.userId));
        // All users with active push subscriptions
        const subscribers = await prisma_1.prisma.pushSubscription.findMany({
            select: { userId: true },
            distinct: ['userId'],
        });
        for (const { userId } of subscribers) {
            if (bettedIds.has(userId))
                continue;
            await sendNotification(userId, '⏰ Match starting in 1 hour!', `${match.homeTeam.name} vs ${match.awayTeam.name} — you haven't placed a bet yet.`, '/matches');
        }
        if (subscribers.some(s => !bettedIds.has(s.userId))) {
            console.log(`[Push] Sent bet reminders for match ${match.id}: ${match.homeTeam.code} vs ${match.awayTeam.code}`);
        }
    }
}
//# sourceMappingURL=pushService.js.map