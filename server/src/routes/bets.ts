import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const matchBetSchema = z.object({
  predictedHome: z.number().int().min(0).max(30),
  predictedAway: z.number().int().min(0).max(30),
});

const specialBetSchema = z.object({
  type: z.enum(['CHAMPION', 'TOP_SCORER', 'TOP_ASSISTS']),
  teamId: z.number().int().positive().optional(),
  playerName: z.string().min(2).max(60).optional(),
});

// ─── GET /api/bets/my  (all current user's bets) ─────────────────────────────

router.get('/my', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const [matchBets, specialBets] = await Promise.all([
    prisma.matchBet.findMany({
      where: { userId: req.userId },
      include: {
        match: {
          include: {
            homeTeam: { select: { id: true, name: true, code: true, group: true } },
            awayTeam: { select: { id: true, name: true, code: true, group: true } },
          },
        },
      },
    }),
    prisma.specialBet.findMany({
      where: { userId: req.userId },
      include: { team: { select: { id: true, name: true, code: true } } },
    }),
  ]);
  res.json({ matchBets, specialBets });
});

// ─── POST /api/bets/match/:matchId  (place or update a match bet) ─────────────

router.post('/match/:matchId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = matchBetSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
    return;
  }

  const matchId = parseInt(req.params.matchId as string);
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) { res.status(404).json({ message: 'Match not found' }); return; }
  if (match.status !== 'UPCOMING') {
    res.status(409).json({ message: 'Bets are locked for this match' });
    return;
  }

  const bet = await prisma.matchBet.upsert({
    where: { userId_matchId: { userId: req.userId!, matchId } },
    update: { predictedHome: parse.data.predictedHome, predictedAway: parse.data.predictedAway },
    create: { userId: req.userId!, matchId, predictedHome: parse.data.predictedHome, predictedAway: parse.data.predictedAway },
  });

  res.status(201).json({ bet });
});

// ─── DELETE /api/bets/match/:matchId  (remove a bet) ─────────────────────────

router.delete('/match/:matchId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const matchId = parseInt(req.params.matchId as string);
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) { res.status(404).json({ message: 'Match not found' }); return; }
  if (match.status !== 'UPCOMING') {
    res.status(409).json({ message: 'Bets are locked for this match' });
    return;
  }

  await prisma.matchBet.delete({
    where: { userId_matchId: { userId: req.userId!, matchId } },
  }).catch(() => {}); // ok if no bet exists

  res.status(204).send();
});

// ─── POST /api/bets/special  (place or update a special bet) ──────────────────

router.post('/special', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = specialBetSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
    return;
  }

  const { type, teamId, playerName } = parse.data;

  // Validate: CHAMPION needs teamId, scorer/assists need playerName
  if (type === 'CHAMPION' && !teamId) {
    res.status(400).json({ message: 'Champion bet requires a teamId' }); return;
  }
  if ((type === 'TOP_SCORER' || type === 'TOP_ASSISTS') && !playerName) {
    res.status(400).json({ message: 'Top scorer/assists bet requires a player name' }); return;
  }

  const bet = await prisma.specialBet.upsert({
    where: { userId_type: { userId: req.userId!, type } },
    update: { teamId: teamId ?? null, playerName: playerName ?? null },
    create: { userId: req.userId!, type, teamId: teamId ?? null, playerName: playerName ?? null },
    include: { team: { select: { id: true, name: true, code: true } } },
  });

  res.status(201).json({ bet });
});

// ─── GET /api/bets/special/my ─────────────────────────────────────────────────

router.get('/special/my', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const specialBets = await prisma.specialBet.findMany({
    where: { userId: req.userId },
    include: { team: { select: { id: true, name: true, code: true } } },
  });
  res.json({ specialBets });
});

export default router;
