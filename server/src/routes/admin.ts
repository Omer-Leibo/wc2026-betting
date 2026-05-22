import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { scoreSpecialBets } from '../services/scoring';

const router = Router();
const prisma = new PrismaClient();

// All routes here require admin role
router.use(authenticate, requireAdmin);

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

router.get('/users', async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: {
      id: true, username: true, email: true, role: true, createdAt: true,
      _count: { select: { matchBets: true, specialBets: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ users });
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────

router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (id === req.userId) {
    res.status(400).json({ message: 'Cannot delete your own account' }); return;
  }
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
});

// ─── PATCH /api/admin/users/:id/role ──────────────────────────────────────────

const roleSchema = z.object({ role: z.enum(['USER', 'ADMIN']) });

router.patch('/users/:id/role', async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = roleSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ message: 'Invalid role' }); return; }

  const id = parseInt(req.params.id as string);
  const user = await prisma.user.update({
    where: { id },
    data: { role: parse.data.role },
    select: { id: true, username: true, role: true },
  });
  res.json({ user });
});

// ─── GET /api/admin/matches/pending ── matches without results ────────────────

router.get('/matches/pending', async (_req: AuthRequest, res: Response): Promise<void> => {
  const matches = await prisma.match.findMany({
    where: { status: { not: 'FINISHED' } },
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
    },
    orderBy: { matchDate: 'asc' },
  });
  res.json({ matches });
});

// ─── GET /api/admin/matches/:id/bets ── all bets for a match ─────────────────

router.get('/matches/:id/bets', async (req: AuthRequest, res: Response): Promise<void> => {
  const matchId = parseInt(req.params.id as string);
  const bets = await prisma.matchBet.findMany({
    where: { matchId },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ bets });
});

// ─── POST /api/admin/special-results ── score special bets ───────────────────

const specialResultSchema = z.object({
  type: z.enum(['CHAMPION', 'TOP_SCORER', 'TOP_ASSISTS']),
  winnerTeamId: z.number().int().positive().optional(),
  winnerPlayerName: z.string().optional(),
});

router.post('/special-results', async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = specialResultSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
    return;
  }

  await scoreSpecialBets(parse.data.type, parse.data.winnerTeamId, parse.data.winnerPlayerName);
  res.json({ message: `${parse.data.type} bets scored successfully` });
});

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  const [userCount, matchCount, finishedCount, betCount] = await Promise.all([
    prisma.user.count(),
    prisma.match.count(),
    prisma.match.count({ where: { status: 'FINISHED' } }),
    prisma.matchBet.count(),
  ]);
  res.json({ stats: { userCount, matchCount, finishedCount, betCount } });
});

export default router;
