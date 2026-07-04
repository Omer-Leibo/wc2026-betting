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

const prisma = new PrismaClient();
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

async function main() {
  // 1. DB state for all knockout stages
  const stages = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'];
  for (const stage of stages) {
    const matches = await prisma.match.findMany({
      where: { stage },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { matchDate: 'asc' },
    });
    console.log(`\n${stage} (${matches.length} matches in DB):`);
    for (const m of matches) {
      console.log(`  [id=${m.id}] ${m.homeTeam.name} vs ${m.awayTeam.name} | ${m.status} | score=${m.homeScore}-${m.awayScore} | externalId=${m.externalId} | date=${m.matchDate.toISOString().slice(0,10)}`);
    }
  }

  // 2. API — fetch all WC matches and show R16 ones
  if (!FOOTBALL_API_KEY) {
    console.log('\nFOOTBALL_API_KEY not set — skipping API check');
    await prisma.$disconnect();
    return;
  }

  console.log('\n\n=== API: All LAST_16 matches ===');
  const url = 'https://api.football-data.org/v4/competitions/WC/matches?stage=LAST_16';
  const res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } });
  if (!res.ok) {
    const text = await res.text();
    console.error('API error:', res.status, text);
  } else {
    const { matches } = await res.json();
    console.log(`API returned ${matches.length} LAST_16 matches:`);
    for (const m of matches) {
      console.log(`  [extId=${m.id}] ${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'} | status=${m.status} | stage=${m.stage} | date=${m.utcDate.slice(0,10)}`);
    }
  }

  // 3. Also fetch full match list to see all stages
  console.log('\n=== API: All WC matches by stage ===');
  const allRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
  });
  if (allRes.ok) {
    const { matches: all } = await allRes.json();
    const bystage = {};
    for (const m of all) {
      bystage[m.stage] = (bystage[m.stage] || 0) + 1;
    }
    for (const [stage, count] of Object.entries(bystage)) {
      console.log(`  ${stage}: ${count} matches`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
