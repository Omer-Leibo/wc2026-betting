"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const pushService_1 = require("../services/pushService");
const router = (0, express_1.Router)();
// ─── GET /api/push/vapid-public-key ─────────────────────────────────────────
router.get('/vapid-public-key', (_req, res) => {
    if (!(0, pushService_1.isPushEnabled)() || !process.env.VAPID_PUBLIC_KEY) {
        res.status(503).json({ message: 'Push notifications not configured on this server' });
        return;
    }
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});
// ─── POST /api/push/subscribe ────────────────────────────────────────────────
const subscribeSchema = zod_1.z.object({
    endpoint: zod_1.z.string().url(),
    keys: zod_1.z.object({
        p256dh: zod_1.z.string().min(1),
        auth: zod_1.z.string().min(1),
    }),
});
router.post('/subscribe', auth_1.authenticate, async (req, res) => {
    if (!(0, pushService_1.isPushEnabled)()) {
        res.status(503).json({ message: 'Push notifications not configured' });
        return;
    }
    const parse = subscribeSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'Invalid subscription object' });
        return;
    }
    const { endpoint, keys } = parse.data;
    const userId = req.userId;
    // Upsert: update userId if the same endpoint re-subscribes (e.g. after re-login)
    await prisma_1.prisma.pushSubscription.upsert({
        where: { endpoint },
        update: { userId, p256dh: keys.p256dh, auth: keys.auth },
        create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    res.json({ message: 'Subscribed' });
});
// ─── POST /api/push/unsubscribe ──────────────────────────────────────────────
const unsubscribeSchema = zod_1.z.object({ endpoint: zod_1.z.string().url() });
router.post('/unsubscribe', auth_1.authenticate, async (req, res) => {
    const parse = unsubscribeSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'endpoint is required' });
        return;
    }
    await prisma_1.prisma.pushSubscription.delete({ where: { endpoint: parse.data.endpoint } })
        .catch(() => { });
    res.json({ message: 'Unsubscribed' });
});
exports.default = router;
//# sourceMappingURL=push.js.map