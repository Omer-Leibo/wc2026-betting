"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const scoring_1 = require("../services/scoring");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// GET /api/leaderboard
router.get('/', auth_1.authenticate, async (req, res) => {
    const { entries, hasLiveGames, tournamentStarted } = await (0, scoring_1.getLeaderboard)(req.userId);
    res.json({ leaderboard: entries, hasLiveGames, tournamentStarted });
});
// GET /api/leaderboard/history  — caller's rank snapshots ordered oldest → newest
router.get('/history', auth_1.authenticate, async (req, res) => {
    const snapshots = await prisma_1.prisma.rankSnapshot.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'asc' },
        select: { label: true, rank: true, totalPoints: true, createdAt: true },
    });
    res.json({ snapshots });
});
// GET /api/leaderboard/:userId/breakdown  — per-matchday stats + bonus breakdown
router.get('/:userId/breakdown', auth_1.authenticate, async (req, res) => {
    const targetUserId = parseInt(req.params.userId);
    if (isNaN(targetUserId)) {
        res.status(400).json({ message: 'Invalid userId' });
        return;
    }
    const targetUser = await prisma_1.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, username: true },
    });
    if (!targetUser) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    // ── Load all GROUP matches grouped by round ───────────────────────────────
    const groupMatches = await prisma_1.prisma.match.findMany({
        where: { stage: 'GROUP', groupRound: { not: null } },
        select: { id: true, groupRound: true, status: true, homeScore: true, awayScore: true },
        orderBy: { groupRound: 'asc' },
    });
    // ── Load all knockout matches ─────────────────────────────────────────────
    const knockoutStages = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'];
    const knockoutMatches = await prisma_1.prisma.match.findMany({
        where: { stage: { in: knockoutStages }, status: 'FINISHED' },
        select: { id: true, stage: true, homeScore: true, awayScore: true },
    });
    // ── Load all bets for this user ───────────────────────────────────────────
    const allBets = await prisma_1.prisma.matchBet.findMany({
        where: { userId: targetUserId },
        select: { matchId: true, predictedHome: true, predictedAway: true, pointsAwarded: true },
    });
    const betByMatchId = new Map(allBets.map(b => [b.matchId, b]));
    // ── Load all bonus logs for this user ─────────────────────────────────────
    const bonusLogs = await prisma_1.prisma.bonusLog.findMany({
        where: { userId: targetUserId },
        select: { reason: true, points: true },
    });
    function getWinner(h, a) {
        return h > a ? 'home' : a > h ? 'away' : 'draw';
    }
    // ── Build matchday breakdowns ─────────────────────────────────────────────
    const roundNumbers = [...new Set(groupMatches.map(m => m.groupRound))].sort((a, b) => a - b);
    const allGroupMatchIds = new Set(groupMatches.map(m => m.id));
    const matchdays = roundNumbers.map(round => {
        const roundMatches = groupMatches.filter(m => m.groupRound === round);
        const roundMatchIds = new Set(roundMatches.map(m => m.id));
        const finishedMatches = roundMatches.filter(m => m.status === 'FINISHED');
        let exact = 0, correct = 0, wrong = 0, matchPoints = 0, betCount = 0;
        for (const m of finishedMatches) {
            if (m.homeScore === null || m.awayScore === null)
                continue;
            const bet = betByMatchId.get(m.id);
            if (!bet)
                continue;
            betCount++;
            matchPoints += bet.pointsAwarded ?? 0;
            if (bet.predictedHome === m.homeScore && bet.predictedAway === m.awayScore) {
                exact++;
            }
            else if (getWinner(bet.predictedHome, bet.predictedAway) === getWinner(m.homeScore, m.awayScore)) {
                correct++;
            }
            else {
                wrong++;
            }
        }
        const roundBonusLog = bonusLogs.find(l => l.reason === `R${round}_BONUS`);
        const roundBonus = roundBonusLog?.points ?? 0;
        const uniqueExactBonus = bonusLogs
            .filter(l => {
            if (!l.reason.startsWith('UNIQUE_EXACT_'))
                return false;
            const mId = parseInt(l.reason.replace('UNIQUE_EXACT_', ''));
            return roundMatchIds.has(mId);
        })
            .reduce((s, l) => s + l.points, 0);
        return {
            round,
            totalMatches: roundMatches.length,
            finishedMatches: finishedMatches.length,
            betCount,
            exact,
            correct,
            wrong,
            matchPoints,
            roundBonus,
            uniqueExactBonus,
        };
    });
    // ── Build knockout breakdown ──────────────────────────────────────────────
    const stageOrder = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'];
    const knockoutByStage = stageOrder.map(stage => {
        const stageMatches = knockoutMatches.filter(m => m.stage === stage);
        let exact = 0, correct = 0, wrong = 0, matchPoints = 0, betCount = 0;
        for (const m of stageMatches) {
            if (m.homeScore === null || m.awayScore === null)
                continue;
            const bet = betByMatchId.get(m.id);
            if (!bet)
                continue;
            betCount++;
            matchPoints += bet.pointsAwarded ?? 0;
            if (bet.predictedHome === m.homeScore && bet.predictedAway === m.awayScore) {
                exact++;
            }
            else if (getWinner(bet.predictedHome, bet.predictedAway) === getWinner(m.homeScore, m.awayScore)) {
                correct++;
            }
            else {
                wrong++;
            }
        }
        const uniqueExactBonus = bonusLogs
            .filter(l => {
            if (!l.reason.startsWith('UNIQUE_EXACT_'))
                return false;
            const mId = parseInt(l.reason.replace('UNIQUE_EXACT_', ''));
            return stageMatches.some(m => m.id === mId);
        })
            .reduce((s, l) => s + l.points, 0);
        return { stage, finishedMatches: stageMatches.length, betCount, exact, correct, wrong, matchPoints, uniqueExactBonus };
    }).filter(s => s.finishedMatches > 0 || s.betCount > 0);
    // ── Totals ────────────────────────────────────────────────────────────────
    const totalMatchPoints = allBets.reduce((s, b) => s + (b.pointsAwarded ?? 0), 0);
    const totalRoundBonuses = bonusLogs.filter(l => /^R\d+_BONUS$/.test(l.reason)).reduce((s, l) => s + l.points, 0);
    const totalUniqueExact = bonusLogs.filter(l => l.reason.startsWith('UNIQUE_EXACT_')).reduce((s, l) => s + l.points, 0);
    const totalBonus = bonusLogs.reduce((s, l) => s + l.points, 0);
    res.json({
        userId: targetUser.id,
        username: targetUser.username,
        matchdays,
        knockout: knockoutByStage,
        totals: {
            matchPoints: totalMatchPoints,
            roundBonuses: totalRoundBonuses,
            uniqueExactBonus: totalUniqueExact,
            totalBonus,
            totalPoints: totalMatchPoints + totalBonus,
        },
    });
});
exports.default = router;
//# sourceMappingURL=leaderboard.js.map