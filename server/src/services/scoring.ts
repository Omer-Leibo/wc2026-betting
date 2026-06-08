import { prisma } from '../lib/prisma';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Winner = 'home' | 'away' | 'draw';

function getWinner(home: number, away: number): Winner {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

// ─── Match point table ────────────────────────────────────────────────────────

const MATCH_POINTS: Record<string, { winner: number; exact: number }> = {
  GROUP:         { winner: 1, exact: 3  },
  ROUND_OF_32:   { winner: 2, exact: 4  },
  ROUND_OF_16:   { winner: 2, exact: 5  },
  QUARTER_FINAL: { winner: 3, exact: 6  },
  SEMI_FINAL:    { winner: 4, exact: 7  },
  THIRD_PLACE:   { winner: 4, exact: 8  },
  FINAL:         { winner: 5, exact: 10 },
};

const SPECIAL_POINTS = { CHAMPION: 10, TOP_SCORER: 12, TOP_ASSISTS: 15 };

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

  // Wipe any stale unique-exact bonus for this match so re-scoring is clean
  await prisma.bonusLog.deleteMany({ where: { reason: `UNIQUE_EXACT_${matchId}` } });

  // Unique exact bonus: if exactly one person predicted the right score they get +1
  const exactBetters = allBets.filter(
    (b: { predictedHome: number; predictedAway: number }) =>
      b.predictedHome === match.homeScore && b.predictedAway === match.awayScore
  );
  const uniqueExact = exactBetters.length === 1;

  for (const bet of allBets) {
    const isExact = bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
    const predictedWinner = getWinner(bet.predictedHome, bet.predictedAway);
    const correctWinner = predictedWinner === actualWinner;

    // Base match points only — unique-exact bonus goes to BonusLog separately
    let points = 0;
    if (isExact)          points = pts.exact;
    else if (correctWinner) points = pts.winner;

    await prisma.matchBet.update({
      where: { id: bet.id },
      data: { pointsAwarded: points },
    });
  }

  // Write unique-exact bonus to BonusLog so it shows in the Bonus column
  if (uniqueExact) {
    await prisma.bonusLog.create({
      data: {
        userId: exactBetters[0].userId,
        points: 1,
        reason: `UNIQUE_EXACT_${matchId}`,
      },
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

// ─── Bonus ladders (shared between final scoring and provisional display) ─────

function exactScoreLadder(exactCount: number): number {
  if (exactCount >= 24) return 15;
  if (exactCount >= 23) return 12;
  if (exactCount >= 20) return 10;
  if (exactCount >= 18) return  8;
  if (exactCount >= 16) return  6;
  if (exactCount >= 14) return  5;
  if (exactCount >= 12) return  4;
  return 0;
}

function accuracyLadder(correctCount: number): number {
  if (correctCount >= 24) return 10;
  if (correctCount >= 23) return  8;
  if (correctCount >= 21) return  6;
  if (correctCount >= 18) return  5;
  if (correctCount >= 16) return  4;
  if (correctCount >= 14) return  3;
  if (correctCount >= 12) return  2;
  return 0;
}

export async function scoreGroupRoundBonuses(groupRound: number): Promise<void> {
  const roundMatches = await prisma.match.findMany({
    where: { stage: 'GROUP', groupRound },
  });

  if (roundMatches.length !== 24) return; // round not fully seeded
  const allFinished = roundMatches.every((m: { status: string }) => m.status === 'FINISHED');
  if (!allFinished) return;

  const roundMatchIds = roundMatches.map((m: { id: number }) => m.id);
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const user of users) {
    // Remove any existing bonus for this round (idempotent — clears both old and new format)
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

    // Only the higher of the two bonuses applies
    const bonus = Math.max(exactScoreLadder(exactCount), accuracyLadder(correctCount));

    if (bonus > 0) {
      await prisma.bonusLog.create({
        data: { userId: user.id, points: bonus, reason: `R${groupRound}_BONUS` },
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

export async function getLeaderboard(requestingUserId?: number) {
  // ── Check if the tournament has started (first match kicked off) ──────────
  const firstMatch = await prisma.match.findFirst({ orderBy: { matchDate: 'asc' } });
  const tournamentStarted = firstMatch
    ? firstMatch.status !== 'UPCOMING' || new Date(firstMatch.matchDate) <= new Date()
    : false;

  // ── Fetch all live matches with bets for provisional points ──────────────
  const liveMatches = await prisma.match.findMany({
    where: { status: 'LIVE', homeScore: { not: null }, awayScore: { not: null } },
    include: { bets: true },
  });
  const hasLiveGames = liveMatches.length > 0;

  // Provisional match points: userId → extra pts if live score were final now
  const provisionalMap = new Map<number, number>();
  // Provisional unique-exact bonus from live games: userId → +1 bonus
  const provisionalUniqueExactMap = new Map<number, number>();

  if (hasLiveGames) {
    for (const match of liveMatches) {
      const pts = MATCH_POINTS[match.stage] ?? MATCH_POINTS.GROUP;
      const actualWinner = getWinner(match.homeScore!, match.awayScore!);

      for (const bet of match.bets) {
        const isExact = bet.predictedHome === match.homeScore && bet.predictedAway === match.awayScore;
        const correctWinner = getWinner(bet.predictedHome, bet.predictedAway) === actualWinner;
        let p = 0;
        if (isExact)             p = pts.exact;
        else if (correctWinner)  p = pts.winner;
        if (p > 0) provisionalMap.set(bet.userId, (provisionalMap.get(bet.userId) ?? 0) + p);
      }

      // Provisional unique-exact: if exactly one bettor has the current live score → provisional +1
      const exactBetters = match.bets.filter(
        b => b.predictedHome === match.homeScore && b.predictedAway === match.awayScore,
      );
      if (exactBetters.length === 1) {
        const uid = exactBetters[0].userId;
        provisionalUniqueExactMap.set(uid, (provisionalUniqueExactMap.get(uid) ?? 0) + 1);
      }
    }
  }

  // ── In-progress group round bonus (provisional) ───────────────────────────
  // Find group rounds that have some FINISHED matches but not all 24.
  // Compute the accuracy/exact ladder bonuses based on current state.

  const allGroupMatches = await prisma.match.findMany({
    where: { stage: 'GROUP', groupRound: { not: null } },
    select: { id: true, groupRound: true, status: true, homeScore: true, awayScore: true },
  });

  // Group by round number
  const roundMap = new Map<number, typeof allGroupMatches>();
  for (const m of allGroupMatches) {
    const r = m.groupRound!;
    if (!roundMap.has(r)) roundMap.set(r, []);
    roundMap.get(r)!.push(m);
  }

  // In-progress rounds: exactly 24 total, some finished but not all
  const inProgressRoundMatchIds = new Map<number, Set<number>>(); // round → finished matchId set
  const matchScoreMap = new Map<number, { homeScore: number; awayScore: number }>(); // matchId → scores

  for (const [round, matches] of roundMap) {
    if (matches.length !== 24) continue; // round not fully seeded yet
    const finishedMatches = matches.filter(
      m => m.status === 'FINISHED' && m.homeScore !== null && m.awayScore !== null,
    );
    if (finishedMatches.length > 0 && finishedMatches.length < 24) {
      inProgressRoundMatchIds.set(round, new Set(finishedMatches.map(m => m.id)));
      for (const m of finishedMatches) {
        matchScoreMap.set(m.id, { homeScore: m.homeScore!, awayScore: m.awayScore! });
      }
    }
  }

  const hasInProgressRound = inProgressRoundMatchIds.size > 0;

  // ── Fetch all users with their bets ──────────────────────────────────────
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      matchBets: {
        select: {
          pointsAwarded: true,
          predictedHome: true,
          predictedAway: true,
          matchId: true,
          match: {
            select: {
              homeScore: true,
              awayScore: true,
              status: true,
              stage: true,
              groupRound: true,
            },
          },
        },
      },
      specialBets: {
        select: {
          type: true,
          teamId: true,
          playerName: true,
          pointsAwarded: true,
          team: { select: { name: true } },
        },
      },
      bonusLogs: { select: { points: true } },
    },
  });

  type UserWithBets = typeof users[0];

  const entries = users.map((user: UserWithBets) => {
    const matchPoints   = user.matchBets.reduce((s: number, b: { pointsAwarded: number | null }) => s + (b.pointsAwarded ?? 0), 0);
    const specialPoints = user.specialBets.reduce((s: number, b: { pointsAwarded: number | null }) => s + (b.pointsAwarded ?? 0), 0);
    const bonusPoints   = user.bonusLogs.reduce((s: number, b: { points: number }) => s + b.points, 0);
    const provisionalPoints = provisionalMap.get(user.id) ?? 0;

    // ── Provisional bonus: unique-exact from live games + ladder from in-progress rounds ──
    let provisionalBonusPoints = provisionalUniqueExactMap.get(user.id) ?? 0;

    if (hasInProgressRound) {
      for (const [round, finishedIds] of inProgressRoundMatchIds) {
        // User's bets on finished matches in this in-progress round
        const roundBets = user.matchBets.filter(
          b => b.match.stage === 'GROUP' &&
               b.match.groupRound === round &&
               finishedIds.has(b.matchId),
        );

        let correctCount = 0;
        let exactCount = 0;
        for (const bet of roundBets) {
          const scores = matchScoreMap.get(bet.matchId);
          if (!scores) continue;
          const isExact = bet.predictedHome === scores.homeScore && bet.predictedAway === scores.awayScore;
          const correctWinner =
            getWinner(bet.predictedHome, bet.predictedAway) ===
            getWinner(scores.homeScore, scores.awayScore);
          if (isExact || correctWinner) correctCount++;
          if (isExact) exactCount++;
        }

        // Only the higher of the two bonuses applies (same logic as final scoring)
        provisionalBonusPoints += Math.max(
          exactScoreLadder(exactCount),
          accuracyLadder(correctCount),
        );
      }
    }

    let exactScores = 0;
    let correctScores = 0;
    for (const bet of user.matchBets) {
      const m = bet.match;
      if (m.status !== 'FINISHED' || m.homeScore === null || m.awayScore === null) continue;
      if (bet.predictedHome === m.homeScore && bet.predictedAway === m.awayScore) {
        exactScores++;
      } else if (getWinner(bet.predictedHome, bet.predictedAway) === getWinner(m.homeScore, m.awayScore)) {
        correctScores++;
      }
    }

    const sbChampion = user.specialBets.find((b: { type: string }) => b.type === 'CHAMPION') as typeof user.specialBets[0] | undefined;
    const sbScorer   = user.specialBets.find((b: { type: string }) => b.type === 'TOP_SCORER') as typeof user.specialBets[0] | undefined;
    const sbAssists  = user.specialBets.find((b: { type: string }) => b.type === 'TOP_ASSISTS') as typeof user.specialBets[0] | undefined;

    const totalPoints = matchPoints + specialPoints + bonusPoints;

    return {
      userId: user.id,
      username: user.username,
      matchPoints,
      specialPoints,
      bonusPoints,
      totalPoints,
      provisionalPoints,      // extra match pts if live score becomes final
      provisionalBonusPoints, // extra bonus pts from in-progress rounds / live unique-exact
      exactScores,
      correctScores,
      // Hide other users' special bets until the tournament has started
      specialBetDetails: (tournamentStarted || user.id === requestingUserId) ? {
        champion:   sbChampion ? { name: sbChampion.team?.name ?? '—', pointsAwarded: sbChampion.pointsAwarded } : null,
        topScorer:  sbScorer   ? { name: sbScorer.playerName   ?? '—', pointsAwarded: sbScorer.pointsAwarded   } : null,
        topAssists: sbAssists  ? { name: sbAssists.playerName  ?? '—', pointsAwarded: sbAssists.pointsAwarded  } : null,
      } : null,
    };
  });

  type Entry = typeof entries[0];

  // Sort by full live total (finalized + provisional match pts + provisional bonus)
  entries.sort((a: Entry, b: Entry) =>
    (b.totalPoints + b.provisionalPoints + b.provisionalBonusPoints) -
    (a.totalPoints + a.provisionalPoints + a.provisionalBonusPoints),
  );

  let rank = 1;
  const ranked = entries.map((e: Entry, i: number) => {
    const liveTotal = e.totalPoints + e.provisionalPoints + e.provisionalBonusPoints;
    const prev = i > 0 ? entries[i - 1] : null;
    const prevLiveTotal = prev ? prev.totalPoints + prev.provisionalPoints + prev.provisionalBonusPoints : null;
    if (i > 0 && prevLiveTotal !== liveTotal) rank = i + 1;
    return { rank, ...e };
  });

  return { entries: ranked, hasLiveGames, tournamentStarted };
}
