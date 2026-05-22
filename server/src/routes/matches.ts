import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { scoreMatch } from '../services/scoring';

const router = Router();
const prisma = new PrismaClient();

const teamSelect = { id: true, name: true, code: true, group: true, flagUrl: true };

// ─── GET /api/matches  (all matches, grouped by stage) ────────────────────────

router.get('/', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const matches = await prisma.match.findMany({
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
    orderBy: [{ stage: 'asc' }, { groupRound: 'asc' }, { matchDate: 'asc' }],
  });
  res.json({ matches });
});

// ─── GET /api/matches/stage/:stage ────────────────────────────────────────────

router.get('/stage/:stage', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const matches = await prisma.match.findMany({
    where: { stage: (req.params.stage as string) as any },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
    orderBy: [{ groupRound: 'asc' }, { matchDate: 'asc' }],
  });
  res.json({ matches });
});

// ─── GET /api/matches/group/:group ────────────────────────────────────────────

router.get('/group/:group', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const group = (req.params.group as string).toUpperCase();
  const matches = await prisma.match.findMany({
    where: {
      stage: 'GROUP',
      OR: [
        { homeTeam: { group } },
        { awayTeam: { group } },
      ],
    },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
    orderBy: [{ groupRound: 'asc' }, { matchDate: 'asc' }],
  });
  res.json({ matches });
});

// ─── GET /api/matches/:id ─────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const match = await prisma.match.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
  });
  if (!match) { res.status(404).json({ message: 'Match not found' }); return; }
  res.json({ match });
});

// ─── PATCH /api/matches/:id/result  (admin only) ──────────────────────────────

const resultSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  status: z.enum(['LIVE', 'FINISHED']).optional(),
});

router.patch('/:id/result', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = resultSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
    return;
  }

  const id = parseInt(req.params.id as string);
  const { homeScore, awayScore, status } = parse.data;

  const finalStatus = status ?? 'FINISHED';
  const match = await prisma.match.update({
    where: { id },
    data: { homeScore, awayScore, status: finalStatus },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
  });

  // Auto-score bets when match is marked FINISHED
  if (finalStatus === 'FINISHED') {
    try {
      await scoreMatch(id);
    } catch (err) {
      console.error('Scoring failed for match', id, err);
      // Don't fail the request — score can be retried
    }
  }

  res.json({ match });
});

// ─── POST /api/matches  (admin only — add knockout match) ─────────────────────

const createMatchSchema = z.object({
  homeTeamId: z.number().int().positive(),
  awayTeamId: z.number().int().positive(),
  stage: z.enum(['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL']),
  matchDate: z.string().datetime(),
  venue: z.string().optional(),
  groupRound: z.number().int().min(1).max(3).optional(),
});

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = createMatchSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
    return;
  }

  const match = await prisma.match.create({
    data: { ...parse.data, matchDate: new Date(parse.data.matchDate) },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
  });

  res.status(201).json({ match });
});

// ─── GET /api/matches/teams  (all teams) ──────────────────────────────────────

router.get('/meta/teams', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const teams = await prisma.team.findMany({
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  });
  res.json({ teams });
});

export default router;
