import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { scoreMatch } from '../services/scoring';

const router = Router();

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

// ─── GET /api/matches/standings ──────────────────────────────────────────────
// Computes group-stage standings from all GROUP matches that have a score.
// Includes every team (even 0-played) so the table is always complete.

router.get('/standings', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const teamSel = { id: true, name: true, code: true, group: true, flagUrl: true };

  const [scoredMatches, allTeams] = await Promise.all([
    prisma.match.findMany({
      where: { stage: 'GROUP', homeScore: { not: null }, awayScore: { not: null } },
      include: { homeTeam: { select: teamSel }, awayTeam: { select: teamSel } },
    }),
    prisma.team.findMany({ select: teamSel, orderBy: { name: 'asc' } }),
  ]);

  interface Row {
    team: typeof allTeams[0];
    played: number; won: number; drawn: number; lost: number;
    gf: number; ga: number; gd: number; pts: number;
    live: boolean;
  }

  const rows = new Map<number, Row>();

  // Seed every team with a blank row
  for (const team of allTeams) {
    rows.set(team.id, { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0, live: false });
  }

  // Accumulate results
  for (const m of scoredMatches) {
    const h = rows.get(m.homeTeam.id)!;
    const a = rows.get(m.awayTeam.id)!;
    const hs = m.homeScore!;
    const as_ = m.awayScore!;
    const isLive = m.status === 'LIVE';

    h.played++; h.gf += hs; h.ga += as_; h.gd = h.gf - h.ga; if (isLive) h.live = true;
    a.played++; a.gf += as_; a.ga += hs; a.gd = a.gf - a.ga; if (isLive) a.live = true;

    if (hs > as_)       { h.won++;   h.pts += 3; a.lost++; }
    else if (hs === as_) { h.drawn++; h.pts += 1; a.drawn++; a.pts += 1; }
    else                 { h.lost++;  a.won++;    a.pts += 3; }
  }

  // Group and sort by FIFA tiebreakers: Pts → GD → GF → name
  const grouped: Record<string, Row[]> = {};
  for (const row of rows.values()) {
    const g = row.team.group;
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(row);
  }
  for (const g of Object.keys(grouped)) {
    grouped[g].sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
      a.team.name.localeCompare(b.team.name),
    );
  }

  res.json({ standings: grouped });
});

// ─── GET /api/matches/bracket ── all knockout matches for bracket view ────────

router.get('/bracket', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const matches = await prisma.match.findMany({
    where: {
      stage: { in: ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'] },
    },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
    orderBy: [{ stage: 'asc' }, { bracketSlot: 'asc' }, { matchDate: 'asc' }],
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
  bracketSlot: z.number().int().min(1).max(16).nullable().optional(),
});

router.patch('/:id/result', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = resultSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
    return;
  }

  const id = parseInt(req.params.id as string);
  const { homeScore, awayScore, status, bracketSlot } = parse.data;

  const finalStatus = status ?? 'FINISHED';
  const match = await prisma.match.update({
    where: { id },
    data: {
      homeScore,
      awayScore,
      status: finalStatus,
      ...(bracketSlot !== undefined ? { bracketSlot } : {}),
    },
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
  stage: z.enum(['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL']),
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

// ─── GET /api/matches/meta/teams  (all teams) ────────────────────────────────

router.get('/meta/teams', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const teams = await prisma.team.findMany({
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  });
  res.json({ teams });
});

// ─── GET /api/matches/meta/players  (all players, grouped by team) ────────────

router.get('/meta/players', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const players = await prisma.player.findMany({
    include: { team: { select: { id: true, name: true, code: true, group: true, flagUrl: true } } },
    orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }],
  });
  res.json({ players });
});

// ─── GET /api/matches/meta/first-kickoff  (datetime of earliest match) ────────

router.get('/meta/first-kickoff', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const first = await prisma.match.findFirst({ orderBy: { matchDate: 'asc' } });
  res.json({ firstKickoff: first?.matchDate ?? null });
});

export default router;
