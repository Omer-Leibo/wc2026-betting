import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getLeaderboard } from '../services/scoring';

const router = Router();

// GET /api/leaderboard
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { entries, hasLiveGames, tournamentStarted } = await getLeaderboard(req.userId);
  res.json({ leaderboard: entries, hasLiveGames, tournamentStarted });
});

export default router;
