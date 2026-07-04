/**
 * sync-missing-r16.mjs
 *
 * Fetches all WC LAST_16 matches from the API and creates any that are
 * missing from the DB. Safe to re-run — skips matches that already exist.
 *
 * Usage:
 *   node scripts/sync-missing-r16.mjs           # dry-run
 *   node scripts/sync-missing-r16.mjs --execute  # apply
 */

import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const DRY_RUN = !process.argv.includes('--execute');
const prisma = new PrismaClient();
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
if (!FOOTBALL_API_KEY) { console.error('FOOTBALL_API_KEY not set'); process.exit(1); }

// Team name aliases (mirrors footballApi.ts)
const ALIASES = {
  'Korea Republic': 'South Korea',
  'Republic of Korea': 'South Korea',
  "Côte d'Ivoire": 'Ivory Coast',
  "Cote d'Ivoire": 'Ivory Coast',
  'IR Iran': 'Iran',
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'Bosnia': 'Bosnia-Herzegovina',
  'United States': 'United States',
  'USA': 'United States',
  'Cape Verde': 'Cape Verde Islands',
};
function normaliseName(name) {
  return ALIASES[name] ?? name;
}

function mapStatus(apiStatus) {
  const finished = ['FINISHED', 'AWARDED'];
  const live = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'];
  if (finished.includes(apiStatus)) return 'FINISHED';
  if (live.includes(apiStatus)) return 'LIVE';
  return 'UPCOMING';
}

async function resolveTeam(apiId, apiName) {
  if (!apiId || !apiName || apiName === 'TBD') return null;

  // Try by externalId first
  const byId = await prisma.team.findUnique({ where: { externalId: apiId } });
  if (byId) return byId;

  // Fall back to name
  const normName = normaliseName(apiName);
  const byName = await prisma.team.findFirst({
    where: {
      OR: [
        { name: { equals: normName, mode: 'insensitive' } },
        { name: { equals: apiName, mode: 'insensitive' } },
      ],
    },
  });
  if (byName) {
    if (!DRY_RUN) {
      await prisma.team.update({ where: { id: byName.id }, data: { externalId: apiId } });
    }
    return byName;
  }

  console.warn(`  ⚠️  Team not found in DB: "${apiName}" (apiId=${apiId})`);
  return null;
}

async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY RUN — no changes will be made (pass --execute to apply)\n'
    : '✏️  EXECUTE MODE — changes WILL be written to the DB\n');

  // Fetch all LAST_16 matches from the API
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches?stage=LAST_16', {
    headers: { 'X-Auth-Token': FOOTBALL_API_KEY },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const { matches } = await res.json();
  console.log(`API returned ${matches.length} LAST_16 matches.\n`);

  let created = 0;
  let skipped = 0;

  for (const m of matches) {
    const homeTeamName = m.homeTeam?.name ?? 'TBD';
    const awayTeamName = m.awayTeam?.name ?? 'TBD';

    // Skip TBD slots
    if (homeTeamName === 'TBD' || awayTeamName === 'TBD' || !m.homeTeam?.id || !m.awayTeam?.id) {
      console.log(`  ⏭️  Skipping TBD match (externalId=${m.id})`);
      continue;
    }

    // Check if already in DB by externalId
    const existing = await prisma.match.findFirst({ where: { externalId: m.id } });
    if (existing) {
      console.log(`  ✅ Already exists: ${homeTeamName} vs ${awayTeamName} (DB id=${existing.id})`);
      skipped++;
      continue;
    }

    // Resolve teams
    const homeTeam = await resolveTeam(m.homeTeam.id, homeTeamName);
    const awayTeam = await resolveTeam(m.awayTeam.id, awayTeamName);

    if (!homeTeam || !awayTeam) {
      console.log(`  ❌ Cannot create: ${homeTeamName} vs ${awayTeamName} — team(s) not found in DB`);
      continue;
    }

    // Compute score
    const duration = m.score?.duration ?? 'REGULAR';
    let homeScore = null;
    let awayScore = null;
    if (m.status === 'FINISHED' || m.status === 'AWARDED') {
      if (duration === 'PENALTY_SHOOTOUT' && m.score?.regularTime) {
        homeScore = (m.score.regularTime.home ?? 0) + (m.score.extraTime?.home ?? 0);
        awayScore = (m.score.regularTime.away ?? 0) + (m.score.extraTime?.away ?? 0);
      } else {
        homeScore = m.score?.fullTime?.home ?? null;
        awayScore = m.score?.fullTime?.away ?? null;
      }
    }

    const status = mapStatus(m.status);
    const matchDate = new Date(m.utcDate);

    console.log(`  ➕ Create: ${homeTeamName} vs ${awayTeamName} | ${m.utcDate.slice(0,10)} | status=${status}`);

    if (!DRY_RUN) {
      await prisma.match.create({
        data: {
          externalId: m.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          stage: 'ROUND_OF_16',
          groupRound: null,
          matchDate,
          venue: m.venue ?? null,
          homeScore,
          awayScore,
          status,
        },
      });
      created++;
    } else {
      created++; // count would-be creations
    }
  }

  console.log(`\n${DRY_RUN ? 'Would create' : 'Created'} ${created} match(es). Skipped ${skipped} existing.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
