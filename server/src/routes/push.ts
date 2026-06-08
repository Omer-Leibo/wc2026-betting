import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { isPushEnabled } from '../services/pushService';

const router = Router();

// ─── GET /api/push/vapid-public-key ─────────────────────────────────────────

router.get('/vapid-public-key', (_req, res: Response): void => {
  if (!isPushEnabled() || !process.env.VAPID_PUBLIC_KEY) {
    res.status(503).json({ message: 'Push notifications not configured on this server' });
    return;
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ─── POST /api/push/subscribe ────────────────────────────────────────────────

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
});

router.post('/subscribe', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isPushEnabled()) {
    res.status(503).json({ message: 'Push notifications not configured' });
    return;
  }

  const parse = subscribeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Invalid subscription object' });
    return;
  }

  const { endpoint, keys } = parse.data;
  const userId = req.userId!;

  // Upsert: update userId if the same endpoint re-subscribes (e.g. after re-login)
  await prisma.pushSubscription.upsert({
    where:  { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  res.json({ message: 'Subscribed' });
});

// ─── POST /api/push/unsubscribe ──────────────────────────────────────────────

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

router.post('/unsubscribe', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = unsubscribeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'endpoint is required' });
    return;
  }

  await prisma.pushSubscription.delete({ where: { endpoint: parse.data.endpoint } })
    .catch(() => {/* already gone — silent */});

  res.json({ message: 'Unsubscribed' });
});

export default router;
