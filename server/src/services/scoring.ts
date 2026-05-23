import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Winner = 'home' | 'away' | 'draw';

function getWinner(home: number, away: number): Winner {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

// ─── Match point table ────────────────────────────────────────────────────────

const MATCH_POINTS: Record<string, { winner: number; exact: number }> = {
  GROUP:         { winner: 1, exact: 3 },
  ROUND_OF_32:   { winner: 2, exact: 4 },
  ROUND_OF_16:   { winner: 2, exact: 4 },
  QUARTER_FINAL: { winner: 2, exact: 4 },
  SEMI_FINAL:    { winner: 3, exact: 5 },
  THIRD_PLACE:   { winner: 3, exact: 5 },
  FINAL:         { winner: 3, exact: 5 },
};

const SPECIAL_POINTS = { CHAMPION: 5, TOP_SCORER: 4, TOP_ASSISTS: 3 };

// ─── Score one match for all bettors ─────────────────────────────────────────

export async function scoreMatch(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { bets: true },
  });

  if (!match || match.status !== 'FINISHED' || match.homeScore === null || match.awayScore === null) {
    throw new Error('Match is not finished or scores are missing');
  }

  const pts = MATCH_POINTS[match.stage] ?? MATCH_POINTS.GROUP;
  const actualWinner = getWinner(match.homeScore, match.awayScore);
  const allBets = match.bets;

  // Unique exact bonus: only one person with the exact score gets +1
  const exactBetters = allBets.filter(
    (b: { predictedHome: number; predictedAway: number }) =>
      b.predictedHome === match.homeScore && b.predictedAway === match.awayScore
  );
  const uniqueExact = exactBetters.length === 1;

  for (const bet of allBets) {
    const isExact = bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
    const predictedWinner = getWinner(bet.predictedHome, bet.predictedAway);
    const correctWinner = predictedWinner === actualWinner;

    let points = 0;
    if (isExact) {
      points = pts.exact + (uniqueExact ? 1 : 0);
    } else if (correctWinner) {
      points = pts.winner;
    }

    await prisma.matchBet.update({
      where: { id: bet.id },
      data: { pointsAwarded: points },
    });
  }

  // Group stage round bonuses — triggered after every group match
  if (match.stage === 'GROUP' && match.groupRound !== null) {
    await scoreGroupRoundBonuses(match.groupRound!);
  }
}

// ─── Group stage round bonuses ────────────────────────────────────────────────
//
// Once ALL 24 matches in a group-stage matchday are finished, each user gets
// bonus points based on how many they got right (accuracy ladder) and how
// many exact scores they had (exact ladder).
// Bonuses are stored in BonusLog (not injected into MatchBet rows) so the
// leaderboard can show them as a separate column.

async function scoreGroupRoundBonuses(groupRound: number): Promise<void> {
  const roundMatches = await prisma.match.findMany({
    where: { stage: 'GROUP', groupRound },
  });

  if (roundMatches.length !== 24) return; // round not fully seeded
  const allFinished = roundMatches.every((m: { status: string }) => m.status === 'FINISHED');
  if (!allFinished) return;

  const roundMatchIds = roundMatches.map((m: { id: number }) => m.id);
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const user of users) {
    // Remove any existing bonus for this round (idempotent)
    await prisma.bonusLog.deleteMany({
      where: { userId: user.id, reason: { startsWith: `R${groupRound}_` } },
    });

    const userBets = await prisma.matchBet.findMany({
      where: { userId: user.id, matchId: { in: roundMatchIds } },
      include: { match: true },
    });

    let correctCount = 0;
    let exactCount = 0;

    for (const bet of userBets) {
      const m = bet.match;
      if (m.homeScore === null || m.awayScore === null) continue;
      const isExact = bet.predictedHome === m.homeScore && bet.predictedAway === m.awayScore;
      const correctWinner = getWinner(bet.predictedHome, bet.predictedAway) === getWinner(m.homeScore, m.awayScore);
      if (isExact || correctWinner) correctCount++;
      if (isExact) exactCount++;
    }

    // Accuracy ladder: how many results (correct winner OR exact) did they get right
    let accuracyBonus = 0;
    if (correctCount >= 23)      accuracyBonus = 4;
    else if (correctCount >= 21) accuracyBonus = 3;
    else if (correctCount >= 18) accuracyBonus = 2;

    // Exact score ladder
    let exactBonus = 0;
    if (exactCount >= 24)      exactBonus = 5;
    else if (exactCount >= 18) exactBonus = 4;
    else if (exactCount >= 12) exactBonus = 3;

    if (accuracyBonus > 0) {
      await prisma.bonusLog.create({
        data: { userId: user.id, points: accuracyBonus, reason: `R${groupRound}_ACCURACY` },
      });
    }
    if (exactBonus > 0) {
      await prisma.bonusLog.create({
        data: { userId: user.id, points: exactBonus, reason: `R${groupRound}_EXACT_LADDER` },
      });
    }
  }
}

// ─── Score special bets ───────────────────────────────────────────────────────

export async function scoreSpecialBets(
  type: 'CHAMPION' | 'TOP_SCORER' | 'TOP_ASSISTS',
  winnerTeamId?: number,
  winnerPlayerName?: string
): Promise<void> {
  const bets = await prisma.specialBet.findMany({ where: { type } });
  const pts = SPECIAL_POINTS[type];

  for (const bet of bets) {
    let won = false;
    if (type === 'CHAMPION' && winnerTeamId) {
      won = bet.teamId === winnerTeamId;
    } else if ((type === 'TOP_SCORER' || type === 'TOP_ASSISTS') && winnerPlayerName) {
      won = bet.playerName?.toLowerCase().trim() === winnerPlayerName.toLowerCase().trim();
    }
    await prisma.specialBet.update({
      where: { id: bet.id },
      data: { pointsAwarded: won ? pts : 0 },
    });
  }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      matchBets: {
        select: {
          pointsAwarded: true,
          predictedHome: true,
          predictedAway: true,
          match: { select: { homeScore: true, awayScore: true, status: true } },
        },
      },
      specialBets: { select: { pointsAwarded: true } },
      bonusLogs:   { select: { points: true } },
    },
  });

  type UserWithBets = typeof users[0];

  const entries = users.map((user: UserWithBets) => {
    const matchPoints  = user.matchBets.reduce((s: number, b: { pointsAwarded: number | null }) => s + (b.pointsAwarded ?? 0), 0);
    const specialPoints = user.specialBets.reduce((s: number, b: { pointsAwarded: number | null }) => s + (b.pointsAwarded ?? 0), 0);
    const bonusPoints  = user.bonusLogs.reduce((s: number, b: { points: number }) => s + b.points, 0);

    let exactScores = 0;
    let correctScores = 0; // correct winner only (not exact)

    for (const bet of user.matchBets) {
      const m = bet.match;
      if (m.status !== 'FINISHED' || m.homeScore === null || m.awayScore === null) continue;
      if (bet.predictedHome === m.homeScore && bet.predictedAway === m.awayScore) {
        exactScores++;
      } else if (getWinner(bet.predictedHome, bet.predictedAway) === getWinner(m.homeScore, m.awayScore)) {
        correctScores++;
      }
    }

    return {
      userId: user.id,
      username: user.username,
      matchPoints,
      specialPoints,
      bonusPoints,
      totalPoints: matchPoints + specialPoints + bonusPoints,
      exactScores,
      correctScores,
    };
  });

  type Entry = typeof entries[0];
  entries.sort((a: Entry, b: Entry) => b.totalPoints - a.totalPoints);
  let rank = 1;
  return entries.map((e: Entry, i: number) => {
    if (i > 0 && entries[i - 1].totalPoints !== e.totalPoints) rank = i + 1;
    return { rank, ...e };
  });
}
