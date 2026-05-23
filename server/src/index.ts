import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Allow any origin in development (covers localhost + phone on same WiFi).
// In production set CLIENT_URL to the deployed frontend domain.
const allowedOrigin = process.env.CLIENT_URL;
app.use(cors({
  origin: allowedOrigin
    ? allowedOrigin                // production: exact domain from .env
    : (_origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, true), // dev: allow all
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
});

export default app;
