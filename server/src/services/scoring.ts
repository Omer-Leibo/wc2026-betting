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
  GROUP:        { winner: 1, exact: 3 },
  ROUND_OF_32:  { winner: 2, exact: 4 }, // treated same as R16
  ROUND_OF_16:  { winner: 2, exact: 4 },
  QUARTER_FINAL:{ winner: 2, exact: 4 },
  SEMI_FINAL:   { winner: 3, exact: 5 },
  FINAL:        { winner: 3, exact: 5 },
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

  const pts = MATCH_POINTS[match.stage];
  const actualWinner = getWinner(match.homeScore, match.awayScore);
  const allBets = match.bets;

  // Find who got the exact score (to award unique-exact bonus)
  const exactBetters = allBets.filter(
    (b: { predictedHome: number; predictedAway: number }) => b.predictedHome === match.homeScore && b.predictedAway === match.awayScore
  );
  const uniqueExact = exactBetters.length === 1;

  // Update each bet with points
  for (const bet of allBets) {
    const isExact = bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
    const predictedWinner = getWinner(bet.predictedHome, bet.predictedAway);
    const correctWinner = predictedWinner === actualWinner;

    let points = 0;
    if (isExact) {
      points = pts.exact;
      if (uniqueExact) points += 1; // bonus: only one with exact score
    } else if (correctWinner) {
      points = pts.winner;
    }

    await prisma.matchBet.update({
      where: { id: bet.id },
      data: { pointsAwarded: points },
    });
  }

  // After scoring, check group stage round bonuses for each user
  if (match.stage === 'GROUP' && match.groupRound !== null) {
    await scoreGroupRoundBonuses(match.groupRound!);
  }
}

// ─── Group stage round bonuses ────────────────────────────────────────────────
//
// A "round" in the group stage = all 24 games played in that matchday.
// Bonuses are calculated once ALL 24 games in the round are finished.

async function scoreGroupRoundBonuses(groupRound: number): Promise<void> {
  // Check if all 24 matches in this round are finished
  const roundMatches = await prisma.match.findMany({
    where: { stage: 'GROUP', groupRound },
  });

  if (roundMatches.length !== 24) return; // not a full round yet
  const allFinished = roundMatches.every((m: { status: string }) => m.status === 'FINISHED');
  if (!allFinished) return;

  const roundMatchIds = roundMatches.map((m: { id: number }) => m.id);

  // Get all users who have at least 1 bet in this round
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const user of users) {
    const userBets = await prisma.matchBet.findMany({
      where: { userId: user.id, matchId: { in: roundMatchIds } },
      include: { match: true },
    });

    let correctCount = 0;   // winner OR exact
    let exactCount = 0;     // exact score only

    for (const bet of userBets) {
      const m = bet.match;
      if (m.homeScore === null || m.awayScore === null) continue;

      const isExact = bet.predictedHome === m.homeScore && bet.predictedAway === m.awayScore;
      const correctWinner = getWinner(bet.predictedHome, bet.predictedAway) === getWinner(m.homeScore, m.awayScore);

      if (isExact || correctWinner) correctCount++;
      if (isExact) exactCount++;
    }

    // Accuracy ladder bonus (based on correct winners/exact scores total)
    let accuracyBonus = 0;
    if (correctCount >= 23)      accuracyBonus = 4;   // 23–24 correct
    else if (correctCount >= 21) accuracyBonus = 3;   // 21–22 correct
    else if (correctCount >= 18) accuracyBonus = 2;   // 18–20 correct

    // Exact score ladder bonus
    let exactBonus = 0;
    if (exactCount >= 24)      exactBonus = 5;
    else if (exactCount >= 18) exactBonus = 4;
    else if (exactCount >= 12) exactBonus = 3;

    // Store bonuses — we update bets with a virtual "bonus" allocation.
    // Strategy: distribute bonuses evenly across the first few bets of this round,
    // then surface them in the leaderboard via aggregation.
    // Simpler: store bonus on the user record via a separate BonusRecord table.
    // For now we use a simple approach: add bonus points into a dedicated column
    // by updating the first bet of the round for that user with the bonus metadata.
    // (The leaderboard service will sum pointsAwarded + bonusPoints.)

    const totalBonus = accuracyBonus + exactBonus;
    if (totalBonus > 0 && userBets.length > 0) {
      // We store the round bonus on the first bet (by id) as extra points
      // This is a clean signal: the leaderboard sums all pointsAwarded
      const firstBet = userBets.sort((a: { id: number }, b: { id: number }) => a.id - b.id)[0];
      const currentPoints = firstBet.pointsAwarded ?? 0;
      await prisma.matchBet.update({
        where: { id: firstBet.id },
        data: { pointsAwarded: currentPoints + totalBonus },
      });
    }
  }
}

// ─── Score a special bet (called by admin when setting final results) ─────────

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

// ─── Leaderboard calculation ──────────────────────────────────────────────────

export async function getLeaderboard() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      matchBets: { select: { pointsAwarded: true, predictedHome: true, predictedAway: true, match: { select: { homeScore: true, awayScore: true, status: true } } } },
      specialBets: { select: { pointsAwarded: true } },
    },
  });

  type UserWithBets = typeof users[0];
  const entries = users.map((user: UserWithBets) => {
    const matchPoints = user.matchBets.reduce((sum: number, b: { pointsAwarded: number | null }) => sum + (b.pointsAwarded ?? 0), 0);
    const specialPoints = user.specialBets.reduce((sum: number, b: { pointsAwarded: number | null }) => sum + (b.pointsAwarded ?? 0), 0);

    // Count correct results across all finished bets
    let exactScores = 0;
    let correctWinners = 0;
    for (const bet of user.matchBets) {
      const m = bet.match;
      if (m.status !== 'FINISHED' || m.homeScore === null || m.awayScore === null) continue;
      if (bet.predictedHome === m.homeScore && bet.predictedAway === m.awayScore) {
        exactScores++;
      } else if (getWinner(bet.predictedHome, bet.predictedAway) === getWinner(m.homeScore, m.awayScore)) {
        correctWinners++;
      }
    }

    return {
      userId: user.id,
      username: user.username,
      matchPoints,
      specialPoints,
      bonusPoints: 0, // bonuses are folded into matchPoints via the scoring engine
      totalPoints: matchPoints + specialPoints,
      exactScores,
      correctWinners,
    };
  });

  type Entry = typeof entries[0];
  // Rank (ties share rank)
  entries.sort((a: Entry, b: Entry) => b.totalPoints - a.totalPoints);
  let rank = 1;
  return entries.map((e: Entry, i: number) => {
    if (i > 0 && entries[i - 1].totalPoints !== e.totalPoints) rank = i + 1;
    return { rank, ...e };
  });
}
