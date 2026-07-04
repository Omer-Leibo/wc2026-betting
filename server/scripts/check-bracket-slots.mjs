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

async function main() {
  const stages = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'];
  for (const stage of stages) {
    const matches = await prisma.match.findMany({
      where: { stage },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { bracketSlot: 'asc' },
    });
    console.log(`\n${stage} (${matches.length}):`);
    for (const m of matches) {
      console.log(`  id=${m.id} slot=${m.bracketSlot} | ${m.homeTeam.name} vs ${m.awayTeam.name} | ${m.matchDate.toISOString().slice(0,10)}`);
    }
  }

  // Also check R32 to see the slot pattern
  const r32 = await prisma.match.findMany({
    where: { stage: 'ROUND_OF_32' },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { bracketSlot: 'asc' },
  });
  console.log(`\nROUND_OF_32 (${r32.length}) — first few:`);
  for (const m of r32.slice(0, 5)) {
    console.log(`  id=${m.id} slot=${m.bracketSlot} | ${m.homeTeam.name} vs ${m.awayTeam.name}`);
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
