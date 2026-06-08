import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if matchDate is more than 60 seconds in the future */
function isBettingOpen(matchDate: Date): boolean {
  return matchDate.getTime() - Date.now() > 60_000;
}

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

// ─── GET /api/bets/all  (all users' bets for matches where betting is closed) ─

router.get('/all', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  // Betting is closed when: match is not UPCOMING, OR kickoff is within 1 minute
  const cutoff = new Date(Date.now() + 60_000);

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { status: { not: 'UPCOMING' } },
        { matchDate: { lte: cutoff } },
      ],
    },
    include: {
      homeTeam: { select: { id: true, name: true, code: true, group: true, flagUrl: true } },
      awayTeam: { select: { id: true, name: true, code: true, group: true, flagUrl: true } },
      bets: {
        include: { user: { select: { id: true, username: true } } },
        orderBy: { user: { username: 'asc' } },
      },
    },
    orderBy: { matchDate: 'asc' },
  });

  // Fetch unique-exact bonus logs for these matches so we can add the +1
  // to pointsAwarded in the display (total points per match, not split).
  const matchIds = matches.map((m: { id: number }) => m.id);
  const uniqueExactLogs = await prisma.bonusLog.findMany({
    where: { reason: { in: matchIds.map((id: number) => `UNIQUE_EXACT_${id}`) } },
  });
  // key: "matchId_userId" → bonus points
  const uniqueExactMap = new Map<string, number>();
  for (const log of uniqueExactLogs) {
    const matchId = log.reason.replace('UNIQUE_EXACT_', '');
    uniqueExactMap.set(`${matchId}_${log.userId}`, log.points);
  }

  const result = matches.map((m: typeof matches[0]) => ({
    id: m.id,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    stage: m.stage,
    groupRound: m.groupRound,
    matchDate: m.matchDate,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    bets: m.bets.map((b: typeof m.bets[0]) => ({
      userId: b.user.id,
      username: b.user.username,
      predictedHome: b.predictedHome,
      predictedAway: b.predictedAway,
      // Total points for this match = base points + unique-exact bonus (if any)
      pointsAwarded: b.pointsAwarded !== null
        ? b.pointsAwarded + (uniqueExactMap.get(`${m.id}_${b.user.id}`) ?? 0)
        : null,
    })),
  }));

  res.json({ matches: result });
});

// ─── GET /api/bets/compare/:userId  (head-to-head comparison) ────────────────
// Returns all closed matches with only my bet + opponent's bet (lightweight).

router.get('/compare/:userId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const myId     = req.userId!;
  const theirId  = parseInt(req.params.userId as string);

  if (theirId === myId) {
    res.status(400).json({ message: 'Cannot compare with yourself' }); return;
  }

  const cutoff = new Date(Date.now() + 60_000);
  const teamSel = { id: true, name: true, code: true, group: true, flagUrl: true };

  const [matches, opponent] = await Promise.all([
    prisma.match.findMany({
      where: {
        OR: [{ status: { not: 'UPCOMING' } }, { matchDate: { lte: cutoff } }],
      },
      include: {
        homeTeam: { select: teamSel },
        awayTeam: { select: teamSel },
        bets: {
          where: { userId: { in: [myId, theirId] } },
          select: { userId: true, predictedHome: true, predictedAway: true, pointsAwarded: true },
        },
      },
      orderBy: { matchDate: 'asc' },
    }),
    prisma.user.findUnique({ where: { id: theirId }, select: { id: true, username: true } }),
  ]);

  if (!opponent) { res.status(404).json({ message: 'User not found' }); return; }

  const result = matches.map(m => ({
    id: m.id,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    stage: m.stage,
    groupRound: m.groupRound,
    matchDate: m.matchDate,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    myBet:    m.bets.find(b => b.userId === myId)    ? { predictedHome: m.bets.find(b => b.userId === myId)!.predictedHome, predictedAway: m.bets.find(b => b.userId === myId)!.predictedAway, pointsAwarded: m.bets.find(b => b.userId === myId)!.pointsAwarded } : null,
    theirBet: m.bets.find(b => b.userId === theirId) ? { predictedHome: m.bets.find(b => b.userId === theirId)!.predictedHome, predictedAway: m.bets.find(b => b.userId === theirId)!.predictedAway, pointsAwarded: m.bets.find(b => b.userId === theirId)!.pointsAwarded } : null,
  }));

  res.json({ matches: result, opponent });
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

  if (!isBettingOpen(match.matchDate)) {
    res.status(409).json({ message: 'Bets are locked — less than 1 minute to kick-off' });
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

  if (match.status !== 'UPCOMING' || !isBettingOpen(match.matchDate)) {
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

  // Lock special bets 1 minute before the first match kicks off
  const firstMatch = await prisma.match.findFirst({ orderBy: { matchDate: 'asc' } });
  if (firstMatch && !isBettingOpen(firstMatch.matchDate)) {
    res.status(409).json({ message: 'Special bets are locked — the tournament has begun' });
    return;
  }

  const { type, teamId, playerName } = parse.data;

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
