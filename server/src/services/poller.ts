import { PrismaClient } from '@prisma/client';
import { syncLiveFixtures, syncAllFixtures } from './syncService';

const prisma = new PrismaClient();

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 min — no live games
const LIVE_INTERVAL_MS    = 60 * 1000;      // 1 min — during live games (free tier: 10 req/min)

// WC 2026 date window — only poll during the tournament.
// In test mode (FOOTBALL_API_COMPETITION set to something other than WC),
// the date restriction is bypassed so you can test with live games today.
const TOURNAMENT_START = new Date('2026-06-11T00:00:00Z');
const TOURNAMENT_END   = new Date('2026-07-20T00:00:00Z');

let pollerHandle: NodeJS.Timeout | null = null;

function isTournamentActive(): boolean {
  const testMode = process.env.FOOTBALL_API_COMPETITION &&
                   process.env.FOOTBALL_API_COMPETITION !== 'WC';
  if (testMode) return true;
  const now = new Date();
  return now >= TOURNAMENT_START && now <= TOURNAMENT_END;
}

async function hasLiveMatches(): Promise<boolean> {
  const count = await prisma.match.count({ where: { status: 'LIVE' } });
  return count > 0;
}

/** Single poll tick — runs sync, then schedules the next tick adaptively. */
async function pollTick(): Promise<void> {
  if (!isTournamentActive()) {
    pollerHandle = setTimeout(pollTick, DEFAULT_INTERVAL_MS);
    return;
  }

  try {
    const result = await syncLiveFixtures();
    if (result.matchesUpdated > 0 || result.newlyScored > 0) {
      console.log(`[Poller] Live sync: ${result.matchesUpdated} updated, ${result.newlyScored} newly scored`);
    }
  } catch (err) {
    console.error('[Poller] Live sync error:', err);
  }

  // Choose next interval based on whether live games are happening right now
  const live = await hasLiveMatches();
  const nextMs = live ? LIVE_INTERVAL_MS : DEFAULT_INTERVAL_MS;
  pollerHandle = setTimeout(pollTick, nextMs);
}

export async function startPoller(): Promise<void> {
  if (!process.env.FOOTBALL_API_KEY || process.env.FOOTBALL_API_KEY === 'your_football_data_key_here') {
    console.log('[Poller] FOOTBALL_API_KEY not set — live sync disabled.');
    console.log('[Poller] Register free at https://www.football-data.org/client/register then add key to .env');
    return;
  }

  // Do an initial full sync on startup
  console.log('[Poller] Running initial full sync...');
  try {
    const result = await syncAllFixtures();
    console.log(`[Poller] Initial sync complete: ${result.matchesUpdated} matches updated, ${result.newlyScored} scored, ${result.teamsLinked} teams linked`);
    if (result.errors.length) console.warn('[Poller] Sync warnings:', result.errors);
  } catch (err) {
    console.error('[Poller] Initial sync failed:', err);
  }

  // Start adaptive polling — 1 min if games are already live, 5 min otherwise
  const live = await hasLiveMatches();
  const firstInterval = live ? LIVE_INTERVAL_MS : DEFAULT_INTERVAL_MS;
  pollerHandle = setTimeout(pollTick, firstInterval);
  console.log(`[Poller] Auto-sync started — ${LIVE_INTERVAL_MS / 1000}s during live games / ${DEFAULT_INTERVAL_MS / 1000}s when idle`);
}

export function stopPoller(): void {
  if (pollerHandle) {
    clearTimeout(pollerHandle);
    pollerHandle = null;
    console.log('[Poller] Stopped');
  }
}
