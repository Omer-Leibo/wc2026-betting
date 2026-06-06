import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
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
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
import authRouter from './routes/auth';
app.use('/api/auth', authRouter);
import matchesRouter from './routes/matches';
app.use('/api/matches', matchesRouter);
import betsRouter from './routes/bets';
app.use('/api/bets', betsRouter);
import leaderboardRouter from './routes/leaderboard';
app.use('/api/leaderboard', leaderboardRouter);
import adminRouter from './routes/admin';
app.use('/api/admin', adminRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  // Start the live-data background poller after server is ready
  import('./services/poller').then(({ startPoller }) => startPoller());
  // Start hourly DB backups
  import('./services/backupService').then(({ startBackupScheduler }) => startBackupScheduler());
});

export default app;
