import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getLeaderboard } from '../services/scoring';

const router = Router();

// GET /api/leaderboard
router.get('/', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const { entries, hasLiveGames } = await getLeaderboard();
  res.json({ leaderboard: entries, hasLiveGames });
});

export default router;
