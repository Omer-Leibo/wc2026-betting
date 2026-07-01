"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// ─── Validation schemas ───────────────────────────────────────────────────────
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(2).max(30).refine(s => s.trim().length >= 2, 'Username must be at least 2 characters'),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
        return;
    }
    // Block registration once the tournament has started (first match kicked off or within 1 min)
    const firstMatch = await prisma_1.prisma.match.findFirst({
        orderBy: { matchDate: 'asc' },
        select: { status: true, matchDate: true },
    });
    if (firstMatch) {
        const tournamentStarted = firstMatch.status !== 'UPCOMING' ||
            new Date(firstMatch.matchDate).getTime() - Date.now() <= 60000;
        if (tournamentStarted) {
            res.status(403).json({ message: 'Registration is closed — the tournament has already started' });
            return;
        }
    }
    const { username, password } = parse.data;
    const email = parse.data.email.toLowerCase();
    const existing = await prisma_1.prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
    });
    if (existing) {
        res.status(409).json({ message: existing.email === email ? 'Email already in use' : 'Username already taken' });
        return;
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
    await prisma_1.prisma.user.create({
        data: { username, email, password: hashedPassword, status: 'PENDING' },
        select: { id: true },
    });
    // Account created but PENDING — don't issue a JWT until the admin approves
    res.status(201).json({
        pending: true,
        message: "Account created! Your registration is pending admin approval. You'll be able to log in once approved.",
    });
});
// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
        return;
    }
    const { password } = parse.data;
    const email = parse.data.email.toLowerCase();
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
    }
    const valid = await bcryptjs_1.default.compare(password, user.password);
    if (!valid) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
    }
    // Block non-active accounts
    if (user.status === 'PENDING') {
        res.status(403).json({ message: 'Your account is awaiting admin approval. Please check back later.' });
        return;
    }
    if (user.status === 'REJECTED') {
        res.status(403).json({ message: 'Your registration was declined. Contact the admin for more information.' });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
        token,
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
});
// ─── PATCH /api/auth/change-password ─────────────────────────────────────────
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string(),
    newPassword: zod_1.z.string().min(6, 'New password must be at least 6 characters'),
});
router.patch('/change-password', auth_1.authenticate, async (req, res) => {
    const parse = changePasswordSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ message: parse.error.errors[0].message });
        return;
    }
    const { currentPassword, newPassword } = parse.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    const valid = await bcryptjs_1.default.compare(currentPassword, user.password);
    if (!valid) {
        res.status(400).json({ message: 'Current password is incorrect' });
        return;
    }
    const hashed = await bcryptjs_1.default.hash(newPassword, 10);
    await prisma_1.prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });
    res.json({ message: 'Password changed successfully' });
});
// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', auth_1.authenticate, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, username: true, email: true, role: true },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    res.json({ user });
});
exports.default = router;
//# sourceMappingURL=auth.js.map