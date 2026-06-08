import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// CLIENT_URL can be a comma-separated list of allowed origins, e.g.:
//   https://wc2026-betting-one.vercel.app,https://preview-xyz.vercel.app
// In development (no CLIENT_URL set) all origins are allowed.
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim())
  : null;

app.use(cors({
  origin: allowedOrigins
    ? (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => {
        // Allow server-to-server requests (no origin) and listed origins
        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error(`CORS: origin ${origin} not allowed`));
        }
      }
    : (_origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, true),
  credentials: true,
}));

// Body parser — cap at 20 KB to block oversized-payload floods
app.use(express.json({ limit: '20kb' }));

// ─── Rate limiting ────────────────────────────────────────────────────────────

// General limiter: 150 requests per 15 minutes per IP for all routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use(generalLimiter);

// Auth limiter: 10 requests per 15 minutes per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again in 15 minutes.' },
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
import authRouter from './routes/auth';
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRouter);
import matchesRouter from './routes/matches';
app.use('/api/matches', matchesRouter);
import betsRouter from './routes/bets';
app.use('/api/bets', betsRouter);
import leaderboardRouter from './routes/leaderboard';
app.use('/api/leaderboard', leaderboardRouter);
import adminRouter from './routes/admin';
app.use('/api/admin', adminRouter);
import pushRouter from './routes/push';
app.use('/api/push', pushRouter);

// Initialise VAPID push before starting (non-fatal if keys are absent)
import { initWebPush } from './services/pushService';
initWebPush();

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  // Start the live-data background poller after server is ready
  import('./services/poller').then(({ startPoller }) => startPoller());
  // Start hourly DB backups
  import('./services/backupService').then(({ startBackupScheduler }) => startBackupScheduler());
});

export default app;
