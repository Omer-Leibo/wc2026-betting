/**
 * fix-r32-stage.mjs
 *
 * Fixes Round of 32 matches that were incorrectly stored with stage='GROUP'
 * (and groupRound=null) instead of stage='ROUND_OF_32'.
 *
 * Also auto-assigns bracketSlot values based on team names.
 * After fixing the stage it re-scores any already-finished matches.
 *
 * Usage:
 *   node scripts/fix-r32-stage.mjs           # dry-run (read-only preview)
 *   node scripts/fix-r32-stage.mjs --execute  # apply changes
 *
 * Requires DATABASE_URL in server/.env (use the Railway public URL).
 */

import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
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

// ─── Match scoring tables (mirrors scoring.ts) ────────────────────────────────
const MATCH_POINTS = {
  GROUP:         { winner: 1, exact: 3  },
  ROUND_OF_32:   { winner: 2, exact: 4  },
  ROUND_OF_16:   { winner: 2, exact: 5  },
  QUARTER_FINAL: { winner: 3, exact: 6  },
  SEMI_FINAL:    { winner: 4, exact: 7  },
  THIRD_PLACE:   { winner: 4, exact: 8  },
  FINAL:         { winner: 5, exact: 10 },
};

// ─── Bracket slot assignments ─────────────────────────────────────────────────
// home/away name variants (lowercase).  Script checks both orientations.
const BRACKET_SLOTS = [
  { slot:  1, home: ['germany','ger'],                                          away: ['paraguay','par'] },
  { slot:  2, home: ['france','fra'],                                           away: ['sweden','swe'] },
  { slot:  3, home: ['south africa','rsa','zaf','southafrica'],                 away: ['canada','can'] },
  { slot:  4, home: ['netherlands','ned','nld','holland'],                      away: ['morocco','mar'] },
  { slot:  5, home: ['brazil','bra'],                                           away: ['japan','jpn'] },
  { slot:  6, home: ['ivory coast','civ',"côte d'ivoire","cote d'ivoire"],      away: ['norway','nor'] },
  { slot:  7, home: ['mexico','mex'],                                           away: ['ecuador','ecu'] },
  { slot:  8, home: ['england','eng'],                                          away: ['dr congo','cod','drc','democratic republic of congo','congo dr','republic of congo'] },
  { slot:  9, home: ['portugal','por'],                                         away: ['croatia','cro','hrv'] },
  { slot: 10, home: ['australia','aus'],                                        away: ['egypt','egy'] },
  { slot: 11, home: ['united states','usa','us','united states of america'],    away: ['bosnia','bih','bos','bosnia and herzegovina','bosnia & herzegovina'] },
  { slot: 12, home: ['belgium','bel'],                                          away: ['senegal','sen'] },
  { slot: 13, home: ['argentina','arg'],                                        away: ['cape verde','cpv','cabo verde'] },
  { slot: 14, home: ['colombia','col'],                                         away: ['ghana','gha'] },
  { slot: 15, home: ['spain','esp'],                                            away: ['austria','aut'] },
  { slot: 16, home: ['switzerland','sui','che'],                                away: ['algeria','alg','dza'] },
];

function matchTeam(teamName, teamCode, nameList) {
  const n = (teamName ?? '').toLowerCase().trim();
  const c = (teamCode ?? '').toLowerCase().trim();
  return nameList.some(v => n === v || c === v || n.includes(v) || v.includes(n));
}

function findBracketSlot(homeTeam, awayTeam) {
  for (const entry of BRACKET_SLOTS) {
    const homeMatch = matchTeam(homeTeam.name, homeTeam.code, entry.home);
    const awayMatch = matchTeam(awayTeam.name, awayTeam.code, entry.away);
    if (homeMatch && awayMatch) return { slot: entry.slot, flipped: false };

    // Also try reversed (API might have home/away swapped)
    const homeMatchR = matchTeam(homeTeam.name, homeTeam.code, entry.away);
    const awayMatchR = matchTeam(awayTeam.name, awayTeam.code, entry.home);
    if (homeMatchR && awayMatchR) return { slot: entry.slot, flipped: true };
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY RUN — no changes will be made (pass --execute to apply)\n'
    : '✏️  EXECUTE MODE — changes WILL be written to the DB\n');

  // Find matches that are staged as GROUP but have dates in the R32 window (Jun 28+)
  // groupRound=null is the key signal that they're not real group matches
  const suspects = await prisma.match.findMany({
    where: {
      stage: 'GROUP',
      groupRound: null,               // real group matches always have groupRound 1-3
      matchDate: { gte: new Date('2026-06-28T00:00:00.000Z') },
    },
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
    },
    orderBy: { matchDate: 'asc' },
  });

  if (suspects.length === 0) {
    console.log('✅ No wrongly-staged matches found — nothing to do.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${suspects.length} match(es) with stage=GROUP & groupRound=null & matchDate≥Jun28:\n`);

  let fixed = 0, skipped = 0, rescored = 0;

  for (const match of suspects) {
    const ht = match.homeTeam;
    const at = match.awayTeam;
    const slot = findBracketSlot(ht, at);

    const slotStr  = slot ? `bracketSlot=${slot.slot}` : 'bracketSlot=UNKNOWN';
    const flipStr  = slot?.flipped ? ' (home/away flipped in DB)' : '';
    const dateStr  = match.matchDate.toISOString().slice(0, 10);
    const statusStr = match.status;

    console.log(`  [${match.id}] ${ht.name} (${ht.code}) vs ${at.name} (${at.code}) | ${dateStr} | ${statusStr} | → ${slotStr}${flipStr}`);

    if (!DRY_RUN) {
      // Fix stage + groupRound + bracketSlot
      await prisma.match.update({
        where: { id: match.id },
        data: {
          stage:       'ROUND_OF_32',
          groupRound:  null,
          bracketSlot: slot?.slot ?? null,
        },
      });
      fixed++;

      // Re-score if already finished (points were calculated with wrong GROUP scoring)
      if (match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null) {
        const bets = await prisma.matchBet.findMany({ where: { matchId: match.id } });
        if (bets.length > 0) {
          const pts = MATCH_POINTS.ROUND_OF_32;
          const getWinner = (h, a) => h > a ? 'home' : a > h ? 'away' : 'draw';
          const actualWinner = getWinner(match.homeScore, match.awayScore);

          // Wipe stale unique-exact bonus then recalculate
          await prisma.bonusLog.deleteMany({ where: { reason: `UNIQUE_EXACT_${match.id}` } });
          const exactBetters = bets.filter(b => b.predictedHome === match.homeScore && b.predictedAway === match.awayScore);
          const uniqueExact  = exactBetters.length === 1;

          for (const bet of bets) {
            const isExact      = bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
            const predictedWin = getWinner(bet.predictedHome, bet.predictedAway);
            const correctWin   = predictedWin === actualWinner;

            let points = 0;
            if (isExact)       points = pts.exact;   // 4
            else if (correctWin) points = pts.winner; // 2

            await prisma.matchBet.update({ where: { id: bet.id }, data: { pointsAwarded: points } });
          }

          if (uniqueExact) {
            await prisma.bonusLog.create({
              data: { userId: exactBetters[0].userId, points: 1, reason: `UNIQUE_EXACT_${match.id}` },
            });
          }

          console.log(`    ↳ Re-scored ${bets.length} bet(s) with ROUND_OF_32 points`);
          rescored++;
        }
      }
    }
  }

  if (DRY_RUN) {
    console.log(`\n📋 Would fix ${suspects.length} match(es). Run with --execute to apply.`);
  } else {
    console.log(`\n✅ Fixed ${fixed} match(es). Re-scored ${rescored} finished match(es).`);
    if (suspects.some(m => !findBracketSlot(m.homeTeam, m.awayTeam))) {
      console.log('⚠️  Some matches could not be auto-assigned a bracketSlot — assign via admin panel.');
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
