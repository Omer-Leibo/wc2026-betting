import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Official WC 2026 qualified teams ────────────────────────────────────────
// Groups and team data sourced from football-data.org (competition WC, season 2026).
// Names, codes and flagUrls match the API exactly to ensure clean team linking.

const teams = [
  // Group A
  { name: 'Mexico',            code: 'MEX', group: 'A', flagUrl: 'https://crests.football-data.org/769.svg' },
  { name: 'South Africa',      code: 'RSA', group: 'A', flagUrl: 'https://crests.football-data.org/9396.svg' },
  { name: 'South Korea',       code: 'KOR', group: 'A', flagUrl: 'https://crests.football-data.org/772.png' },
  { name: 'Czechia',           code: 'CZE', group: 'A', flagUrl: 'https://crests.football-data.org/798.svg' },
  // Group B
  { name: 'Canada',            code: 'CAN', group: 'B', flagUrl: 'https://crests.football-data.org/canada.svg' },
  { name: 'Bosnia-Herzegovina',code: 'BIH', group: 'B', flagUrl: 'https://crests.football-data.org/bosnia.svg' },
  { name: 'Qatar',             code: 'QAT', group: 'B', flagUrl: 'https://crests.football-data.org/8030.svg' },
  { name: 'Switzerland',       code: 'SUI', group: 'B', flagUrl: 'https://crests.football-data.org/788.svg' },
  // Group C
  { name: 'Brazil',            code: 'BRA', group: 'C', flagUrl: 'https://crests.football-data.org/764.svg' },
  { name: 'Morocco',           code: 'MAR', group: 'C', flagUrl: 'https://crests.football-data.org/morocco.svg' },
  { name: 'Haiti',             code: 'HAI', group: 'C', flagUrl: 'https://crests.football-data.org/haiti.svg' },
  { name: 'Scotland',          code: 'SCO', group: 'C', flagUrl: 'https://crests.football-data.org/814.svg' },
  // Group D
  { name: 'United States',     code: 'USA', group: 'D', flagUrl: 'https://crests.football-data.org/usa.svg' },
  { name: 'Paraguay',          code: 'PAR', group: 'D', flagUrl: 'https://crests.football-data.org/761.svg' },
  { name: 'Australia',         code: 'AUS', group: 'D', flagUrl: 'https://crests.football-data.org/779.svg' },
  { name: 'Turkey',            code: 'TUR', group: 'D', flagUrl: 'https://crests.football-data.org/803.svg' },
  // Group E
  { name: 'Germany',           code: 'GER', group: 'E', flagUrl: 'https://crests.football-data.org/759.svg' },
  { name: 'Curaçao',           code: 'CUW', group: 'E', flagUrl: 'https://crests.football-data.org/curacao.svg' },
  { name: 'Ivory Coast',       code: 'CIV', group: 'E', flagUrl: 'https://crests.football-data.org/787.svg' },
  { name: 'Ecuador',           code: 'ECU', group: 'E', flagUrl: 'https://crests.football-data.org/791.svg' },
  // Group F
  { name: 'Netherlands',       code: 'NED', group: 'F', flagUrl: 'https://crests.football-data.org/8601.svg' },
  { name: 'Japan',             code: 'JPN', group: 'F', flagUrl: 'https://crests.football-data.org/766.svg' },
  { name: 'Sweden',            code: 'SWE', group: 'F', flagUrl: 'https://crests.football-data.org/792.svg' },
  { name: 'Tunisia',           code: 'TUN', group: 'F', flagUrl: 'https://crests.football-data.org/tunisia.svg' },
  // Group G
  { name: 'Belgium',           code: 'BEL', group: 'G', flagUrl: 'https://crests.football-data.org/805.svg' },
  { name: 'Egypt',             code: 'EGY', group: 'G', flagUrl: 'https://crests.football-data.org/825.svg' },
  { name: 'Iran',              code: 'IRN', group: 'G', flagUrl: 'https://crests.football-data.org/iran.svg' },
  { name: 'New Zealand',       code: 'NZL', group: 'G', flagUrl: 'https://crests.football-data.org/783.svg' },
  // Group H
  { name: 'Spain',             code: 'ESP', group: 'H', flagUrl: 'https://crests.football-data.org/760.svg' },
  { name: 'Cape Verde Islands',code: 'CPV', group: 'H', flagUrl: 'https://crests.football-data.org/cape_verde.svg' },
  { name: 'Saudi Arabia',      code: 'KSA', group: 'H', flagUrl: 'https://crests.football-data.org/saudi_arabia.svg' },
  { name: 'Uruguay',           code: 'URY', group: 'H', flagUrl: 'https://crests.football-data.org/758.svg' },
  // Group I
  { name: 'France',            code: 'FRA', group: 'I', flagUrl: 'https://crests.football-data.org/773.svg' },
  { name: 'Senegal',           code: 'SEN', group: 'I', flagUrl: 'https://crests.football-data.org/senegal.svg' },
  { name: 'Iraq',              code: 'IRQ', group: 'I', flagUrl: 'https://crests.football-data.org/iraq.svg' },
  { name: 'Norway',            code: 'NOR', group: 'I', flagUrl: 'https://crests.football-data.org/813.svg' },
  // Group J
  { name: 'Argentina',         code: 'ARG', group: 'J', flagUrl: 'https://crests.football-data.org/762.png' },
  { name: 'Algeria',           code: 'ALG', group: 'J', flagUrl: 'https://crests.football-data.org/algeria.svg' },
  { name: 'Austria',           code: 'AUT', group: 'J', flagUrl: 'https://crests.football-data.org/816.svg' },
  { name: 'Jordan',            code: 'JOR', group: 'J', flagUrl: 'https://crests.football-data.org/8049.png' },
  // Group K
  { name: 'Portugal',          code: 'POR', group: 'K', flagUrl: 'https://crests.football-data.org/765.svg' },
  { name: 'Congo DR',          code: 'COD', group: 'K', flagUrl: 'https://crests.football-data.org/congo_dr.svg' },
  { name: 'Uzbekistan',        code: 'UZB', group: 'K', flagUrl: 'https://crests.football-data.org/8070.png' },
  { name: 'Colombia',          code: 'COL', group: 'K', flagUrl: 'https://crests.football-data.org/818.svg' },
  // Group L
  { name: 'England',           code: 'ENG', group: 'L', flagUrl: 'https://crests.football-data.org/770.svg' },
  { name: 'Croatia',           code: 'CRO', group: 'L', flagUrl: 'https://crests.football-data.org/799.svg' },
  { name: 'Ghana',             code: 'GHA', group: 'L', flagUrl: 'https://crests.football-data.org/ghana.svg' },
  { name: 'Panama',            code: 'PAN', group: 'L', flagUrl: 'https://crests.football-data.org/panama.svg' },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Upsert all 48 teams (safe to re-run)
  for (const team of teams) {
    await prisma.team.upsert({
      where: { code: team.code },
      update: { name: team.name, group: team.group, flagUrl: team.flagUrl },
      create: team,
    });
  }

  console.log(`✅ Seeded ${teams.length} teams`);
  console.log('');
  console.log('🎉 Seeding complete!');
  console.log('📡 Run a manual sync from the Admin panel to pull all 104 WC 2026 fixtures.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
