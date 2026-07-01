/**
 * fix-penalty-scores.mjs
 *
 * Fixes Round of 32 matches that went to a penalty shootout and had their
 * score incorrectly stored as the cumulative total (regularTime + ET + pens)
 * instead of the 120-minute score (regularTime + ET only).
 *
 * Root cause: football-data.org fullTime field for PENALTY_SHOOTOUT matches
 * is cumulative (e.g. 3-4 for NED vs MAR instead of the correct 1-1).
 *
 * What this script does:
 *   1. Fetches all WC R32 matches from the API
 *   2. Finds PENALTY_SHOOTOUT matches and computes correct 120-min scores
 *   3. Finds those matches in the DB and shows the diff
 *   4. (--execute) Updates the DB scores and re-scores all bets
 *
 * Usage:
 *   node scripts/fix-penalty-scores.mjs           # dry-run (read-only)
 *   node scripts/fix-penalty-scores.mjs --execute  # apply changes
 */

import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// ─── Load .env ────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const DRY_RUN = !process.argv.includes('--execute');
const prisma   = new PrismaClient();

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
if (!FOOTBALL_API_KEY) { console.error('FOOTBALL_API_KEY not set'); process.exit(1); }

// ROUND_OF_32 scoring table
const R32_POINTS = { winner: 2, exact: 4 };

// ─── Fetch penalty matches from API ──────────────────────────────────────────

async function fetchPenaltyMatches() {
  const url = 'https://api.football-data.org/v4/competitions/WC/matches?stage=LAST_32';
  const res  = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const { matches } = await res.json();

  return matches
    .filter(m => m.score?.duration === 'PENALTY_SHOOTOUT' && m.status === 'FINISHED')
    .map(m => {
      const rtH = m.score.regularTime?.home ?? 0;
      const rtA = m.score.regularTime?.away ?? 0;
      const etH = m.score.extraTime?.home   ?? 0;
      const etA = m.score.extraTime?.away   ?? 0;
      return {
        id:           m.id,
        homeTeamName: m.homeTeam?.name ?? 'Unknown',
        awayTeamName: m.awayTeam?.name ?? 'Unknown',
        correctHome:  rtH + etH,   // 120-min score (no pens)
        correctAway:  rtA + etA,
        penHome:      m.score.penalties?.home ?? null,
        penAway:      m.score.penalties?.away ?? null,
        badHome:      m.score.fullTime.home,  // what we wrongly stored
        badAway:      m.score.fullTime.away,
      };
    });
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function getWinner(home, away) {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

async function rescore(matchId, correctHome, correctAway) {
  const bets = await prisma.matchBet.findMany({ where: { matchId } });
  if (bets.length === 0) return 0;

  const actualWinner = getWinner(correctHome, correctAway);

  // Wipe stale unique-exact bonus then recalculate
  await prisma.bonusLog.deleteMany({ where: { reason: `UNIQUE_EXACT_${matchId}` } });

  const exactBetters = bets.filter(
    b => b.predictedHome === correctHome && b.predictedAway === correctAway,
  );
  const uniqueExact = exactBetters.length === 1;

  for (const bet of bets) {
    const isExact      = bet.predictedHome === correctHome && bet.predictedAway === correctAway;
    const predictedWin = getWinner(bet.predictedHome, bet.predictedAway);
    const correctWin   = predictedWin === actualWinner;

    let points = 0;
    if (isExact)         points = R32_POINTS.exact;   // 4
    else if (correctWin) points = R32_POINTS.winner;  // 2

    await prisma.matchBet.update({ where: { id: bet.id }, data: { pointsAwarded: points } });
  }

  if (uniqueExact) {
    await prisma.bonusLog.create({
      data: {
        userId: exactBetters[0].userId,
        points: 1,
        reason: `UNIQUE_EXACT_${matchId}`,
      },
    });
  }

  return bets.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY RUN — no changes will be made (pass --execute to apply)\n'
    : '✏️  EXECUTE MODE — changes WILL be written to the DB\n');

  const penaltyMatches = await fetchPenaltyMatches();

  if (penaltyMatches.length === 0) {
    console.log('✅ No finished PENALTY_SHOOTOUT R32 matches found in the API — nothing to fix.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${penaltyMatches.length} finished PENALTY_SHOOTOUT match(es):\n`);

  let fixed = 0, rescored = 0;

  for (const pm of penaltyMatches) {
    console.log(`  ${pm.homeTeamName} vs ${pm.awayTeamName}`);
    console.log(`    API externalId : ${pm.id}`);
    console.log(`    Correct score  : ${pm.correctHome}–${pm.correctAway}  (120-min, no pens)`);
    console.log(`    Bad score      : ${pm.badHome}–${pm.badAway}  (was wrongly stored)`);
    console.log(`    Pens           : ${pm.penHome}–${pm.penAway}`);

    // Find in DB by externalId
    const dbMatch = await prisma.match.findFirst({
      where: { externalId: pm.id },
    });

    if (!dbMatch) {
      console.log(`    ⚠️  No DB match found with externalId=${pm.id} — skipping\n`);
      continue;
    }

    const alreadyCorrect =
      dbMatch.homeScore === pm.correctHome &&
      dbMatch.awayScore === pm.correctAway;

    if (alreadyCorrect) {
      console.log(`    ✅ DB score already correct (${dbMatch.homeScore}–${dbMatch.awayScore}) — skipping\n`);
      continue;
    }

    console.log(`    DB match id    : ${dbMatch.id}`);
    console.log(`    DB score now   : ${dbMatch.homeScore}–${dbMatch.awayScore}  → will fix to ${pm.correctHome}–${pm.correctAway}`);

    if (!DRY_RUN) {
      await prisma.match.update({
        where: { id: dbMatch.id },
        data: { homeScore: pm.correctHome, awayScore: pm.correctAway },
      });
      fixed++;

      const betCount = await rescore(dbMatch.id, pm.correctHome, pm.correctAway);
      if (betCount > 0) {
        console.log(`    ↳ Re-scored ${betCount} bet(s)`);
        rescored++;
      } else {
        console.log(`    ↳ No bets found — score updated but nothing to re-score`);
      }
    }
    console.log();
  }

  if (DRY_RUN) {
    console.log(`📋 Would fix scores for ${penaltyMatches.filter(pm => pm.badHome !== pm.correctHome || pm.badAway !== pm.correctAway).length} match(es). Run with --execute to apply.`);
  } else {
    console.log(`✅ Fixed ${fixed} match score(s). Re-scored bets for ${rescored} match(es).`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
