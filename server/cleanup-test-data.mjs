// One-time script to remove test competition matches and teams from the DB.
// Run with: node cleanup-test-data.mjs
// Safe to run multiple times — only deletes non-WC (group='TBD') data.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Delete bets on test matches first (foreign key constraint)
  const bets = await prisma.matchBet.deleteMany({
    where: {
      match: {
        OR: [
          { homeTeam: { group: 'TBD' } },
          { awayTeam: { group: 'TBD' } },
        ],
      },
    },
  });
  console.log(`Deleted ${bets.count} bets on test matches`);

  // Delete the test matches
  const matches = await prisma.match.deleteMany({
    where: {
      OR: [
        { homeTeam: { group: 'TBD' } },
        { awayTeam: { group: 'TBD' } },
      ],
    },
  });
  console.log(`Deleted ${matches.count} test matches`);

  // Delete the test teams
  const teams = await prisma.team.deleteMany({ where: { group: 'TBD' } });
  console.log(`Deleted ${teams.count} test teams`);

  console.log('Done! DB is back to WC-only data.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
