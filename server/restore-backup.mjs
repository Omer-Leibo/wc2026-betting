// Restore a JSON backup created by backupService.ts
//
// Usage (from the server/ folder):
//   node restore-backup.mjs backups/backup_2026-06-11T14-30-00.json
//
// WARNING: This WIPES the current database and replaces it with the backup.
//          Stop the server before running this script.

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

async function main() {
  const filepath = process.argv[2];
  if (!filepath) {
    console.error('Usage: node restore-backup.mjs <backup-file.json>');
    process.exit(1);
  }

  const fullPath = resolve(filepath);
  console.log(`\n📂 Reading backup: ${fullPath}`);

  const raw = JSON.parse(readFileSync(fullPath, 'utf8'));
  const { data, exportedAt, counts } = raw;

  console.log(`\n📋 Backup from: ${exportedAt}`);
  console.log('   Contents:', counts);
  console.log('\n⚠️  This will WIPE the current database. Type YES to continue:');

  // Simple confirmation — read one line from stdin
  const confirmed = await new Promise(resolve => {
    process.stdin.once('data', d => resolve(d.toString().trim()));
  });
  if (confirmed !== 'YES') { console.log('Aborted.'); process.exit(0); }

  console.log('\n🗑  Clearing existing data...');

  // Delete in FK-safe reverse order
  await prisma.bonusLog.deleteMany();
  await prisma.matchBet.deleteMany();
  await prisma.specialBet.deleteMany();
  await prisma.player.deleteMany();
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
  await prisma.syncLog.deleteMany().catch(() => {}); // optional table

  console.log('✓ Tables cleared');

  console.log('\n📥 Restoring data...');

  // Insert in FK-safe order; skipDuplicates is a safety net
  if (data.users?.length)       { await prisma.user.createMany({ data: data.users,       skipDuplicates: true }); console.log(`   users        ${data.users.length}`); }
  if (data.teams?.length)       { await prisma.team.createMany({ data: data.teams,       skipDuplicates: true }); console.log(`   teams        ${data.teams.length}`); }
  if (data.players?.length)     { await prisma.player.createMany({ data: data.players,   skipDuplicates: true }); console.log(`   players      ${data.players.length}`); }
  if (data.matches?.length)     { await prisma.match.createMany({ data: data.matches,    skipDuplicates: true }); console.log(`   matches      ${data.matches.length}`); }
  if (data.matchBets?.length)   { await prisma.matchBet.createMany({ data: data.matchBets, skipDuplicates: true }); console.log(`   matchBets    ${data.matchBets.length}`); }
  if (data.specialBets?.length) { await prisma.specialBet.createMany({ data: data.specialBets, skipDuplicates: true }); console.log(`   specialBets  ${data.specialBets.length}`); }
  if (data.bonusLogs?.length)   { await prisma.bonusLog.createMany({ data: data.bonusLogs, skipDuplicates: true }); console.log(`   bonusLogs    ${data.bonusLogs.length}`); }

  // Reset PostgreSQL sequences so new auto-incremented IDs don't clash
  // with the restored records.
  console.log('\n🔁 Resetting ID sequences...');
  const tables = ['User', 'Team', 'Player', 'Match', 'MatchBet', 'SpecialBet', 'BonusLog'];
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'),
                       COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
      );
    } catch { /* table might not have serial id — skip */ }
  }

  console.log('\n✅ Restore complete! Start the server normally.\n');
}

main()
  .catch(err => { console.error('Restore failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
