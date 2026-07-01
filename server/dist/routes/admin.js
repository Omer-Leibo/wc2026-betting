"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const scoring_1 = require("../services/scoring");
const syncService_1 = require("../services/syncService");
const footballApi_1 = require("../services/footballApi");
const backupService_1 = require("../services/backupService");
const router = (0, express_1.Router)();
// All routes here require admin role
router.use(auth_1.authenticate, auth_1.requireAdmin);
// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', async (_req, res) => {
    const users = await prisma_1.prisma.user.findMany({
        select: {
            id: true, username: true, email: true, role: true, status: true, createdAt: true,
            _count: { select: { matchBets: true, specialBets: true } },
        },
        orderBy: { createdAt: 'asc' },
    });
    res.json({ users });
});
// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    if (id === req.userId) {
        res.status(400).json({ message: 'Cannot delete your own account' });
        return;
    }
    await prisma_1.prisma.user.delete({ where: { id } });
    res.status(204).send();
});
// ─── POST /api/admin/users/:id/reset-password ────────────────────────────────
router.post('/users/:id/reset-password', async (req, res) => {
    const id = parseInt(req.params.id);
    if (id === req.userId) {
        res.status(400).json({ message: 'Cannot reset your own password this way' });
        return;
    }
    // Generate a random 10-char temp password
    const tempPassword = Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 7).toUpperCase();
    const hashed = await bcryptjs_1.default.hash(tempPassword, 10);
    await prisma_1.prisma.user.update({ where: { id }, data: { password: hashed } });
    res.json({ tempPassword });
});
// ─── PATCH /api/admin/users/:id/role ──────────────────────────────────────────
const roleSchema = zod_1.z.object({ role: zod_1.z.enum(['USER', 'ADMIN']) });
router.patch('/users/:id/role', async (req, res) => {
    const parse = roleSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'Invalid role' });
        return;
    }
    const id = parseInt(req.params.id);
    const user = await prisma_1.prisma.user.update({
        where: { id },
        data: { role: parse.data.role },
        select: { id: true, username: true, role: true },
    });
    res.json({ user });
});
// ─── PATCH /api/admin/users/:id/status  (approve / reject) ───────────────────
const statusSchema = zod_1.z.object({ status: zod_1.z.enum(['ACTIVE', 'REJECTED']) });
router.patch('/users/:id/status', async (req, res) => {
    const parse = statusSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'Invalid status' });
        return;
    }
    const id = parseInt(req.params.id);
    if (id === req.userId) {
        res.status(400).json({ message: 'Cannot change your own status' });
        return;
    }
    const user = await prisma_1.prisma.user.update({
        where: { id },
        data: { status: parse.data.status },
        select: { id: true, username: true, status: true },
    });
    res.json({ user });
});
// ─── PATCH /api/admin/matches/:id/bracket-slot ───────────────────────────────
const bracketSlotSchema = zod_1.z.object({
    bracketSlot: zod_1.z.number().int().min(1).max(16).nullable(),
});
router.patch('/matches/:id/bracket-slot', async (req, res) => {
    const parse = bracketSlotSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'bracketSlot must be 1–16 or null' });
        return;
    }
    const id = parseInt(req.params.id);
    await prisma_1.prisma.match.update({ where: { id }, data: { bracketSlot: parse.data.bracketSlot } });
    res.json({ message: 'Bracket slot updated' });
});
// ─── GET /api/admin/matches/pending ── all matches (for result entry) ─────────
router.get('/matches/pending', async (_req, res) => {
    const matches = await prisma_1.prisma.match.findMany({
        include: {
            homeTeam: { select: { id: true, name: true, code: true, flagUrl: true } },
            awayTeam: { select: { id: true, name: true, code: true, flagUrl: true } },
        },
        orderBy: { matchDate: 'asc' },
    });
    res.json({ matches });
});
// ─── GET /api/admin/matches/:id/bets ── all bets for a match ─────────────────
router.get('/matches/:id/bets', async (req, res) => {
    const matchId = parseInt(req.params.id);
    const bets = await prisma_1.prisma.matchBet.findMany({
        where: { matchId },
        include: { user: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'asc' },
    });
    res.json({ bets });
});
// ─── POST /api/admin/rescore-match/:id ── re-score bets for a finished match ──
router.post('/rescore-match/:id', async (req, res) => {
    const matchId = parseInt(req.params.id);
    try {
        await (0, scoring_1.scoreMatch)(matchId);
        res.json({ message: `Match ${matchId} re-scored successfully` });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ message: msg });
    }
});
// ─── POST /api/admin/rescore-group-round ── re-score all bonuses for a round ──
const rescoreRoundSchema = zod_1.z.object({ round: zod_1.z.number().int().min(1).max(3) });
router.post('/rescore-group-round', async (req, res) => {
    const parse = rescoreRoundSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'round must be 1, 2, or 3' });
        return;
    }
    await (0, scoring_1.scoreGroupRoundBonuses)(parse.data.round);
    res.json({ message: `Group stage round ${parse.data.round} bonuses re-scored` });
});
// ─── POST /api/admin/special-results ── score special bets ───────────────────
const specialResultSchema = zod_1.z.object({
    type: zod_1.z.enum(['CHAMPION', 'TOP_SCORER', 'TOP_ASSISTS']),
    winnerTeamId: zod_1.z.number().int().positive().optional(),
    winnerPlayerName: zod_1.z.string().optional(),
});
router.post('/special-results', async (req, res) => {
    const parse = specialResultSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
        return;
    }
    await (0, scoring_1.scoreSpecialBets)(parse.data.type, parse.data.winnerTeamId, parse.data.winnerPlayerName);
    res.json({ message: `${parse.data.type} bets scored successfully` });
});
// ─── POST /api/admin/take-snapshot  (manual leaderboard snapshot) ─────────────
const snapshotLabelSchema = zod_1.z.object({ label: zod_1.z.string().min(1).max(20) });
router.post('/take-snapshot', async (req, res) => {
    const parse = snapshotLabelSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'label is required (max 20 chars)' });
        return;
    }
    await (0, scoring_1.takeLeaderboardSnapshot)(parse.data.label);
    res.json({ message: `Snapshot "${parse.data.label}" saved for all users` });
});
// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
    const [userCount, matchCount, finishedCount, betCount, lastSync] = await Promise.all([
        prisma_1.prisma.user.count(),
        prisma_1.prisma.match.count(),
        prisma_1.prisma.match.count({ where: { status: 'FINISHED' } }),
        prisma_1.prisma.matchBet.count(),
        (0, syncService_1.getLastSync)(),
    ]);
    res.json({ stats: { userCount, matchCount, finishedCount, betCount, lastSync } });
});
// ─── POST /api/admin/sync  (manual full sync) ─────────────────────────────────
router.post('/sync', async (_req, res) => {
    try {
        const result = await (0, syncService_1.syncAllFixtures)();
        res.json({ result });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ message: msg });
    }
});
// ─── POST /api/admin/sync/live  (manual live-only sync) ───────────────────────
router.post('/sync/live', async (_req, res) => {
    try {
        const result = await (0, syncService_1.syncLiveFixtures)();
        res.json({ result });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ message: msg });
    }
});
// ─── GET /api/admin/sync/status ───────────────────────────────────────────────
router.get('/sync/status', async (_req, res) => {
    const [lastSync, quota] = await Promise.all([
        (0, syncService_1.getLastSync)(),
        (0, footballApi_1.fetchQuota)().catch(() => null),
    ]);
    res.json({ lastSync, quota });
});
// ─── POST /api/admin/sync/players  (sync squad data from API) ─────────────────
router.post('/sync/players', async (_req, res) => {
    try {
        const count = await (0, syncService_1.syncPlayers)();
        res.json({ playersSync: count });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ message: msg });
    }
});
// ─── GET /api/admin/backups ── list recent backup files ──────────────────────
router.get('/backups', async (_req, res) => {
    res.json({ backups: (0, backupService_1.listBackups)() });
});
// ─── POST /api/admin/backups ── trigger a manual backup now ──────────────────
router.post('/backups', async (_req, res) => {
    try {
        const filepath = await (0, backupService_1.runBackup)();
        res.json({ message: 'Backup created', filepath });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ message: msg });
    }
});
// ─── GET /api/admin/backups/:filename ── download a backup file ───────────────
router.get('/backups/:filename', (req, res) => {
    const filepath = (0, backupService_1.getBackupPath)(req.params.filename);
    if (!filepath) {
        res.status(404).json({ message: 'Backup not found' });
        return;
    }
    res.download(filepath);
});
exports.default = router;
//# sourceMappingURL=admin.js.map