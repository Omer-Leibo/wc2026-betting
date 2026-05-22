import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
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
