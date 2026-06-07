import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ─── Validation schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  username: z.string().min(2).max(30).refine(s => s.trim().length >= 2, 'Username must be at least 2 characters'),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
    return;
  }

  const { username, password } = parse.data;
  const email = parse.data.email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    res.status(409).json({ message: existing.email === email ? 'Email already in use' : 'Username already taken' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, password: hashedPassword },
    select: { id: true, username: true, email: true, role: true },
  });

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });

  res.status(201).json({ token, user });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Validation error', errors: parse.error.flatten().fieldErrors });
    return;
  }

  const { password } = parse.data;
  const email = parse.data.email.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });

  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
});

// ─── PATCH /api/auth/change-password ─────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

router.patch('/change-password', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = changePasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: parse.error.errors[0].message }); return;
  }
  const { currentPassword, newPassword } = parse.data;
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) { res.status(400).json({ message: 'Current password is incorrect' }); return; }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });
  res.json({ message: 'Password changed successfully' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, username: true, email: true, role: true },
  });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json({ user });
});

export default router;
