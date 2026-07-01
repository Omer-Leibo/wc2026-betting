"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const scoring_1 = require("../services/scoring");
const router = (0, express_1.Router)();
const teamSelect = { id: true, name: true, code: true, group: true, flagUrl: true };
// ─── GET /api/matches  (all matches, grouped by stage) ────────────────────────
router.get('/', auth_1.authenticate, async (_req, res) => {
    const matches = await prisma_1.prisma.match.findMany({
        include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
        orderBy: [{ stage: 'asc' }, { groupRound: 'asc' }, { matchDate: 'asc' }],
    });
    res.json({ matches });
});
// ─── GET /api/matches/stage/:stage ────────────────────────────────────────────
router.get('/stage/:stage', auth_1.authenticate, async (req, res) => {
    const matches = await prisma_1.prisma.match.findMany({
        where: { stage: req.params.stage },
        include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
        orderBy: [{ groupRound: 'asc' }, { matchDate: 'asc' }],
    });
    res.json({ matches });
});
// ─── GET /api/matches/group/:group ────────────────────────────────────────────
router.get('/group/:group', auth_1.authenticate, async (req, res) => {
    const group = req.params.group.toUpperCase();
    const matches = await prisma_1.prisma.match.findMany({
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
router.get('/standings', auth_1.authenticate, async (_req, res) => {
    const teamSel = { id: true, name: true, code: true, group: true, flagUrl: true };
    const [scoredMatches, allTeams] = await Promise.all([
        prisma_1.prisma.match.findMany({
            where: { stage: 'GROUP', homeScore: { not: null }, awayScore: { not: null } },
            include: { homeTeam: { select: teamSel }, awayTeam: { select: teamSel } },
        }),
        prisma_1.prisma.team.findMany({ select: teamSel, orderBy: { name: 'asc' } }),
    ]);
    const rows = new Map();
    // Seed every team with a blank row
    for (const team of allTeams) {
        rows.set(team.id, { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0, live: false });
    }
    // Accumulate results
    for (const m of scoredMatches) {
        const h = rows.get(m.homeTeam.id);
        const a = rows.get(m.awayTeam.id);
        const hs = m.homeScore;
        const as_ = m.awayScore;
        const isLive = m.status === 'LIVE';
        h.played++;
        h.gf += hs;
        h.ga += as_;
        h.gd = h.gf - h.ga;
        if (isLive)
            h.live = true;
        a.played++;
        a.gf += as_;
        a.ga += hs;
        a.gd = a.gf - a.ga;
        if (isLive)
            a.live = true;
        if (hs > as_) {
            h.won++;
            h.pts += 3;
            a.lost++;
        }
        else if (hs === as_) {
            h.drawn++;
            h.pts += 1;
            a.drawn++;
            a.pts += 1;
        }
        else {
            h.lost++;
            a.won++;
            a.pts += 3;
        }
    }
    // Group and sort by FIFA tiebreakers: Pts → GD → GF → name
    const grouped = {};
    for (const row of rows.values()) {
        const g = row.team.group;
        if (!grouped[g])
            grouped[g] = [];
        grouped[g].push(row);
    }
    for (const g of Object.keys(grouped)) {
        grouped[g].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
            a.team.name.localeCompare(b.team.name));
    }
    res.json({ standings: grouped });
});
// ─── GET /api/matches/bracket ── all knockout matches for bracket view ────────
router.get('/bracket', auth_1.authenticate, async (_req, res) => {
    const matches = await prisma_1.prisma.match.findMany({
        where: {
            stage: { in: ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'] },
        },
        include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
        orderBy: [{ stage: 'asc' }, { bracketSlot: 'asc' }, { matchDate: 'asc' }],
    });
    res.json({ matches });
});
// ─── GET /api/matches/:id ─────────────────────────────────────────────────────
router.get('/:id', auth_1.authenticate, async (req, res) => {
    const match = await prisma_1.prisma.match.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
    });
    if (!match) {
        res.status(404).json({ message: 'Match not found' });
        return;
    }
    res.json({ match });
});
// ─── PATCH /api/matches/:id/result  (admin only) ──────────────────────────────
const resultSchema = zod_1.z.object({
    homeScore: zod_1.z.number().int().min(0),
    awayScore: zod_1.z.number().int().min(0),
    status: zod_1.z.enum(['LIVE', 'FINISHED']).optional(),
    bracketSlot: zod_1.z.number().int().min(1).max(16).nullable().optional(),
});
router.patch('/:id/result', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    const parse = resultSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
        return;
    }
    const id = parseInt(req.params.id);
    const { homeScore, awayScore, status, bracketSlot } = parse.data;
    const finalStatus = status ?? 'FINISHED';
    const match = await prisma_1.prisma.match.update({
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
            await (0, scoring_1.scoreMatch)(id);
        }
        catch (err) {
            console.error('Scoring failed for match', id, err);
            // Don't fail the request — score can be retried
        }
    }
    res.json({ match });
});
// ─── POST /api/matches  (admin only — add knockout match) ─────────────────────
const createMatchSchema = zod_1.z.object({
    homeTeamId: zod_1.z.number().int().positive(),
    awayTeamId: zod_1.z.number().int().positive(),
    stage: zod_1.z.enum(['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL']),
    matchDate: zod_1.z.string().datetime(),
    venue: zod_1.z.string().optional(),
    groupRound: zod_1.z.number().int().min(1).max(3).optional(),
});
router.post('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    const parse = createMatchSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
        return;
    }
    const match = await prisma_1.prisma.match.create({
        data: { ...parse.data, matchDate: new Date(parse.data.matchDate) },
        include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
    });
    res.status(201).json({ match });
});
// ─── GET /api/matches/meta/teams  (all teams) ────────────────────────────────
router.get('/meta/teams', auth_1.authenticate, async (_req, res) => {
    const teams = await prisma_1.prisma.team.findMany({
        orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
    res.json({ teams });
});
// ─── GET /api/matches/meta/players  (all players, grouped by team) ────────────
router.get('/meta/players', auth_1.authenticate, async (_req, res) => {
    const players = await prisma_1.prisma.player.findMany({
        include: { team: { select: { id: true, name: true, code: true, group: true, flagUrl: true } } },
        orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }],
    });
    res.json({ players });
});
// ─── GET /api/matches/meta/first-kickoff  (datetime of earliest match) ────────
router.get('/meta/first-kickoff', auth_1.authenticate, async (_req, res) => {
    const first = await prisma_1.prisma.match.findFirst({ orderBy: { matchDate: 'asc' } });
    res.json({ firstKickoff: first?.matchDate ?? null });
});
exports.default = router;
//# sourceMappingURL=matches.js.map