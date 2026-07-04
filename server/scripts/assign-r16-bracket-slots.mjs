/**
 * assign-r16-bracket-slots.mjs
 *
 * Sets bracketSlot (1–8) for all ROUND_OF_16 matches so the
 * BracketPage can render them in the correct bracket positions.
 *
 * Slot ordering follows the actual R32 winner bracket:
 *   Slot 1: Paraguay vs France  (R32 winners from slots 1+2)
 *   Slot 2: Canada vs Morocco   (R32 winners from slots 3+4)
 *   Slot 3: Brazil vs Norway    (R32 winners from slots 5+6)
 *   Slot 4: Mexico vs England   (R32 winners from slots 7+8)
 *   Slot 5: Portugal vs Spain   (cross-bracket: R32 winners 9 + 15)
 *   Slot 6: USA vs Belgium      (R32 winners from slots 11+12)
 *   Slot 7: Argentina vs Egypt  (cross-bracket: R32 winners 13 + 10)
 *   Slot 8: Switzerland vs Colombia (R32 winners 16 + 14)
 *
 * Usage:
 *   node scripts/assign-r16-bracket-slots.mjs           # dry-run
 *   node scripts/assign-r16-bracket-slots.mjs --execute  # apply
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

// externalId → bracketSlot (from football-data.org)
// These IDs come from the API check we just ran
const SLOT_MAP = [
  { externalId: 537375, bracketSlot: 1, label: 'Paraguay vs France' },
  { externalId: 537376, bracketSlot: 2, label: 'Canada vs Morocco' },
  { externalId: 537377, bracketSlot: 3, label: 'Brazil vs Norway' },
  { externalId: 537378, bracketSlot: 4, label: 'Mexico vs England' },
  { externalId: 537379, bracketSlot: 5, label: 'Portugal vs Spain' },
  { externalId: 537380, bracketSlot: 6, label: 'United States vs Belgium' },
  { externalId: 537381, bracketSlot: 7, label: 'Argentina vs Egypt' },
  { externalId: 537382, bracketSlot: 8, label: 'Switzerland vs Colombia' },
];

async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY RUN — no changes will be made (pass --execute to apply)\n'
    : '✏️  EXECUTE MODE — changes WILL be written to the DB\n');

  for (const { externalId, bracketSlot, label } of SLOT_MAP) {
    const match = await prisma.match.findFirst({ where: { externalId } });
    if (!match) {
      console.log(`  ❌ Not found in DB: externalId=${externalId} (${label})`);
      continue;
    }
    if (match.bracketSlot === bracketSlot) {
      console.log(`  ✅ Already correct: slot=${bracketSlot} — ${label} (DB id=${match.id})`);
      continue;
    }
    console.log(`  ➕ Set bracketSlot=${bracketSlot} on DB id=${match.id} — ${label} (was ${match.bracketSlot})`);
    if (!DRY_RUN) {
      await prisma.match.update({ where: { id: match.id }, data: { bracketSlot } });
    }
  }

  console.log('\nDone.');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
