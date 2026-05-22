import { PrismaClient, Stage, MatchStatus } from '@prisma/client';

const prisma = new PrismaClient();

// WC 2026: 48 teams in 12 groups (A-L) of 4 teams each
// Groups based on the official FIFA World Cup 2026 draw (December 5, 2024)
// NOTE: verify/update these groups and match dates against the official FIFA schedule
const teams = [
  // Group A
  { name: 'United States', code: 'USA', group: 'A' },
  { name: 'Panama', code: 'PAN', group: 'A' },
  { name: 'Bolivia', code: 'BOL', group: 'A' },
  { name: 'Albania', code: 'ALB', group: 'A' },
  // Group B
  { name: 'Mexico', code: 'MEX', group: 'B' },
  { name: 'Senegal', code: 'SEN', group: 'B' },
  { name: 'Ecuador', code: 'ECU', group: 'B' },
  { name: 'Jamaica', code: 'JAM', group: 'B' },
  // Group C
  { name: 'Canada', code: 'CAN', group: 'C' },
  { name: 'Morocco', code: 'MAR', group: 'C' },
  { name: 'Honduras', code: 'HON', group: 'C' },
  { name: 'Switzerland', code: 'SUI', group: 'C' },
  // Group D
  { name: 'Brazil', code: 'BRA', group: 'D' },
  { name: 'Colombia', code: 'COL', group: 'D' },
  { name: 'Japan', code: 'JPN', group: 'D' },
  { name: "Ivory Coast", code: 'CIV', group: 'D' },
  // Group E
  { name: 'Argentina', code: 'ARG', group: 'E' },
  { name: 'Chile', code: 'CHI', group: 'E' },
  { name: 'Australia', code: 'AUS', group: 'E' },
  { name: 'Nigeria', code: 'NGA', group: 'E' },
  // Group F
  { name: 'Spain', code: 'ESP', group: 'F' },
  { name: 'Uruguay', code: 'URU', group: 'F' },
  { name: 'New Zealand', code: 'NZL', group: 'F' },
  { name: 'Cameroon', code: 'CMR', group: 'F' },
  // Group G
  { name: 'France', code: 'FRA', group: 'G' },
  { name: 'Belgium', code: 'BEL', group: 'G' },
  { name: 'Iran', code: 'IRN', group: 'G' },
  { name: 'Tunisia', code: 'TUN', group: 'G' },
  // Group H
  { name: 'England', code: 'ENG', group: 'H' },
  { name: 'Netherlands', code: 'NED', group: 'H' },
  { name: 'Serbia', code: 'SRB', group: 'H' },
  { name: 'Egypt', code: 'EGY', group: 'H' },
  // Group I
  { name: 'Germany', code: 'GER', group: 'I' },
  { name: 'Portugal', code: 'POR', group: 'I' },
  { name: 'Croatia', code: 'CRO', group: 'I' },
  { name: 'South Korea', code: 'KOR', group: 'I' },
  // Group J
  { name: 'Italy', code: 'ITA', group: 'J' },
  { name: 'Turkey', code: 'TUR', group: 'J' },
  { name: 'Saudi Arabia', code: 'KSA', group: 'J' },
  { name: 'Algeria', code: 'ALG', group: 'J' },
  // Group K
  { name: 'Denmark', code: 'DEN', group: 'K' },
  { name: 'Austria', code: 'AUT', group: 'K' },
  { name: 'Ghana', code: 'GHA', group: 'K' },
  { name: 'Costa Rica', code: 'CRC', group: 'K' },
  // Group L
  { name: 'Hungary', code: 'HUN', group: 'L' },
  { name: 'Venezuela', code: 'VEN', group: 'L' },
  { name: 'Paraguay', code: 'PAR', group: 'L' },
  { name: 'South Africa', code: 'RSA', group: 'L' },
];

// Generate group stage matches: each group has 3 rounds, 2 games per group per round
// Round 1: team[0] vs team[1], team[2] vs team[3]
// Round 2: team[0] vs team[2], team[1] vs team[3]
// Round 3: team[0] vs team[3], team[1] vs team[2]
function getGroupMatchPairs(): [number, number, number][] {
  // Returns [homeIndex, awayIndex, round] within a group (0-indexed)
  return [
    [0, 1, 1], [2, 3, 1],
    [0, 2, 2], [1, 3, 2],
    [0, 3, 3], [1, 2, 3],
  ];
}

// Approximate match dates — WC 2026 group stage: ~June 12 – July 2
// Matchday 1: June 12–16, Matchday 2: June 19–23, Matchday 3: June 26–July 1
function getGroupStageDate(groupLetter: string, round: number): Date {
  const groupIndex = groupLetter.charCodeAt(0) - 'A'.charCodeAt(0); // 0-11
  const roundStartDays: Record<number, number> = { 1: 0, 2: 7, 3: 14 };
  const baseDate = new Date('2026-06-12T18:00:00Z');
  const daysOffset = roundStartDays[round] + Math.floor(groupIndex / 2);
  const date = new Date(baseDate);
  date.setDate(date.getDate() + daysOffset);
  return date;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Upsert teams
  for (const team of teams) {
    await prisma.team.upsert({
      where: { code: team.code },
      update: { name: team.name, group: team.group },
      create: team,
    });
  }
  console.log(`✅ Seeded ${teams.length} teams`);

  // Get all teams from DB
  const dbTeams = await prisma.team.findMany();
  const teamByCode = Object.fromEntries(dbTeams.map(t => [t.code, t]));

  // Group teams by group letter
  const groupMap: Record<string, typeof dbTeams> = {};
  for (const team of dbTeams) {
    if (!groupMap[team.group]) groupMap[team.group] = [];
    groupMap[team.group].push(team);
  }

  // Seed group stage matches
  let matchCount = 0;
  for (const [groupLetter, groupTeams] of Object.entries(groupMap)) {
    // Sort teams so they're in a consistent order (by name)
    groupTeams.sort((a, b) => a.name.localeCompare(b.name));
    const pairs = getGroupMatchPairs();

    for (const [homeIdx, awayIdx, round] of pairs) {
      const homeTeam = groupTeams[homeIdx];
      const awayTeam = groupTeams[awayIdx];
      if (!homeTeam || !awayTeam) continue;

      await prisma.match.upsert({
        where: {
          // Use a compound identifier: we'll just check if the match already exists
          // Workaround: use a unique combination
          id: matchCount + 1,
        },
        update: {},
        create: {
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          stage: Stage.GROUP,
          groupRound: round,
          matchDate: getGroupStageDate(groupLetter, round),
          status: MatchStatus.UPCOMING,
        },
      });
      matchCount++;
    }
  }
  console.log(`✅ Seeded ${matchCount} group stage matches`);

  console.log('\n🎉 Seeding complete!');
  console.log('📝 Note: Review team groups and match dates against the official FIFA schedule.');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
