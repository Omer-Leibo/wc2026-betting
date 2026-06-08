import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getLeaderboard } from '../services/scoring';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/leaderboard
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { entries, hasLiveGames, tournamentStarted } = await getLeaderboard(req.userId);
  res.json({ leaderboard: entries, hasLiveGames, tournamentStarted });
});

// GET /api/leaderboard/history  — caller's rank snapshots ordered oldest → newest
router.get('/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const snapshots = await prisma.rankSnapshot.findMany({
    where:   { userId: req.userId },
    orderBy: { createdAt: 'asc' },
    select:  { label: true, rank: true, totalPoints: true, createdAt: true },
  });
  res.json({ snapshots });
});

export default router;
