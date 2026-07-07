/**
 * sync-knockout-stage.mjs
 *
 * Fetches matches for a given knockout stage from the API and creates any
 * missing ones in the DB, auto-assigning bracketSlots in chronological order.
 *
 * Usage:
 *   node scripts/sync-knockout-stage.mjs QUARTER_FINALS           # dry-run
 *   node scripts/sync-knockout-stage.mjs QUARTER_FINALS --execute  # apply
 *   node scripts/sync-knockout-stage.mjs SEMI_FINALS --execute
 *   node scripts/sync-knockout-stage.mjs FINAL --execute
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

const API_STAGE = process.argv[2];
if (!API_STAGE) {
  console.error('Usage: node sync-knockout-stage.mjs <API_STAGE> [--execute]');
  console.error('  API_STAGE examples: QUARTER_FINALS, SEMI_FINALS, FINAL, THIRD_PLACE');
  process.exit(1);
}

const DRY_RUN = !process.argv.includes('--execute');
const prisma = new PrismaClient();
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
if (!FOOTBALL_API_KEY) { console.error('FOOTBALL_API_KEY not set'); process.exit(1); }

// Map API stage name → our DB stage enum
const STAGE_MAP = {
  QUARTER_FINALS: 'QUARTER_FINAL',
  QUARTER_FINAL:  'QUARTER_FINAL',
  SEMI_FINALS:    'SEMI_FINAL',
  SEMI_FINAL:     'SEMI_FINAL',
  THIRD_PLACE:    'THIRD_PLACE',
  FINAL:          'FINAL',
  LAST_16:        'ROUND_OF_16',
  LAST_32:        'ROUND_OF_32',
};

const DB_STAGE = STAGE_MAP[API_STAGE];
if (!DB_STAGE) {
  console.error(`Unknown stage "${API_STAGE}". Valid: ${Object.keys(STAGE_MAP).join(', ')}`);
  process.exit(1);
}

const ALIASES = {
  'Korea Republic': 'South Korea',
  'Republic of Korea': 'South Korea',
  "Côte d'Ivoire": 'Ivory Coast',
  "Cote d'Ivoire": 'Ivory Coast',
  'IR Iran': 'Iran',
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'United States': 'United States',
  'Cape Verde': 'Cape Verde Islands',
};
function normaliseName(name) { return ALIASES[name] ?? name; }

function mapStatus(s) {
  if (['FINISHED', 'AWARDED'].includes(s)) return 'FINISHED';
  if (['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(s)) return 'LIVE';
  return 'UPCOMING';
}

async function resolveTeam(apiId, apiName) {
  if (!apiId || !apiName || apiName === 'TBD') return null;
  const byId = await prisma.team.findUnique({ where: { externalId: apiId } });
  if (byId) return byId;
  const norm = normaliseName(apiName);
  const byName = await prisma.team.findFirst({
    where: { OR: [{ name: { equals: norm, mode: 'insensitive' } }, { name: { equals: apiName, mode: 'insensitive' } }] },
  });
  if (byName) {
    if (!DRY_RUN) await prisma.team.update({ where: { id: byName.id }, data: { externalId: apiId } });
    return byName;
  }
  console.warn(`  ⚠️  Team not found: "${apiName}" (id=${apiId})`);
  return null;
}

async function main() {
  console.log(DRY_RUN
    ? `🔍 DRY RUN for ${API_STAGE} — pass --execute to apply\n`
    : `✏️  EXECUTE MODE for ${API_STAGE}\n`);

  const res = await fetch(
    `https://api.football-data.org/v4/competitions/WC/matches?stage=${API_STAGE}`,
    { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } },
  );
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const { matches } = await res.json();
  console.log(`API returned ${matches.length} ${API_STAGE} matches.\n`);

  // Sort chronologically so slot numbers follow bracket order
  matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  // Count existing DB matches in this stage to start slot numbering from
  const existingCount = await prisma.match.count({ where: { stage: DB_STAGE } });
  let nextSlot = existingCount + 1;
  let created = 0, skipped = 0;

  for (const m of matches) {
    const homeName = m.homeTeam?.name ?? 'TBD';
    const awayName = m.awayTeam?.name ?? 'TBD';

    if (homeName === 'TBD' || awayName === 'TBD' || !m.homeTeam?.id || !m.awayTeam?.id) {
      console.log(`  ⏭️  Skipping TBD slot (extId=${m.id})`);
      continue;
    }

    const existing = await prisma.match.findFirst({ where: { externalId: m.id } });
    if (existing) {
      console.log(`  ✅ Already exists: ${homeName} vs ${awayName} (DB id=${existing.id}, slot=${existing.bracketSlot})`);
      skipped++;
      continue;
    }

    const homeTeam = await resolveTeam(m.homeTeam.id, homeName);
    const awayTeam = await resolveTeam(m.awayTeam.id, awayName);
    if (!homeTeam || !awayTeam) {
      console.log(`  ❌ Cannot create: ${homeName} vs ${awayName} — team(s) not in DB`);
      continue;
    }

    // Score
    const duration = m.score?.duration ?? 'REGULAR';
    let homeScore = null, awayScore = null;
    if (['FINISHED', 'AWARDED'].includes(m.status)) {
      if (duration === 'PENALTY_SHOOTOUT' && m.score?.regularTime) {
        homeScore = (m.score.regularTime.home ?? 0) + (m.score.extraTime?.home ?? 0);
        awayScore = (m.score.regularTime.away ?? 0) + (m.score.extraTime?.away ?? 0);
      } else {
        homeScore = m.score?.fullTime?.home ?? null;
        awayScore = m.score?.fullTime?.away ?? null;
      }
    }

    const bracketSlot = nextSlot++;
    console.log(`  ➕ Create slot=${bracketSlot}: ${homeName} vs ${awayName} | ${m.utcDate.slice(0,10)} | ${mapStatus(m.status)}`);

    if (!DRY_RUN) {
      await prisma.match.create({
        data: {
          externalId:  m.id,
          homeTeamId:  homeTeam.id,
          awayTeamId:  awayTeam.id,
          stage:       DB_STAGE,
          groupRound:  null,
          matchDate:   new Date(m.utcDate),
          venue:       m.venue ?? null,
          homeScore,
          awayScore,
          status:      mapStatus(m.status),
          bracketSlot,
        },
      });
      created++;
    } else {
      created++;
    }
  }

  console.log(`\n${DRY_RUN ? 'Would create' : 'Created'} ${created} match(es). Skipped ${skipped} existing.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
