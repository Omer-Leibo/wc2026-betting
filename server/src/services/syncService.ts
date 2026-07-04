import { prisma } from '../lib/prisma';
import {
  fetchAllFixtures,
  fetchLiveFixtures,
  fetchTeams,
  fetchAllSquads,
  mapStatus,
  mapStage,
  normaliseTeamName,
  type ApiFixture,
} from './footballApi';
import { scoreMatch } from './scoring';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  matchesUpdated: number;
  newlyScored: number;
  teamsLinked: number;
  errors: string[];
}

// ─── Team linking ─────────────────────────────────────────────────────────────
//
// On the first sync we try to link every API team to our DB team by name.
// Once linked (externalId set), future syncs use the ID directly.

export async function linkTeams(): Promise<number> {
  const apiTeams = await fetchTeams();
  let linked = 0;

  for (const apiTeam of apiTeams) {
    const normName = normaliseTeamName(apiTeam.team.name);

    // Try to find our team by name
    const dbTeam = await prisma.team.findFirst({
      where: {
        OR: [
          { name: { equals: normName, mode: 'insensitive' } },
          { name: { equals: apiTeam.team.name, mode: 'insensitive' } },
        ],
        externalId: null, // only re-link unlinked teams
      },
    });

    if (dbTeam) {
      await prisma.team.update({
        where: { id: dbTeam.id },
        data: {
          externalId: apiTeam.team.id,
          flagUrl: apiTeam.team.logo,
        },
      });
      linked++;
    }
  }

  return linked;
}

// ─── Sync all fixtures ────────────────────────────────────────────────────────
//
// Full sync: fetches ALL WC 2026 fixtures and upserts them.
// Called once at startup and on manual admin sync.

export async function syncAllFixtures(): Promise<SyncResult> {
  const result: SyncResult = { matchesUpdated: 0, newlyScored: 0, teamsLinked: 0, errors: [] };

  try {
    result.teamsLinked = await linkTeams();
    const fixtures = await fetchAllFixtures();
    result.matchesUpdated = await processFixtures(fixtures, result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error('[Sync] Full sync failed:', msg);
  }

  await logSync(result);
  return result;
}

// ─── Live sync ────────────────────────────────────────────────────────────────
//
// Lightweight sync: only fetches live / recently-finished fixtures.
// Used by the auto-polling background job during the tournament.

export async function syncLiveFixtures(): Promise<SyncResult> {
  const result: SyncResult = { matchesUpdated: 0, newlyScored: 0, teamsLinked: 0, errors: [] };

  try {
    const fixtures = await fetchLiveFixtures();
    if (fixtures.length > 0) {
      result.matchesUpdated = await processFixtures(fixtures, result);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error('[Sync] Live sync failed:', msg);
  }

  if (result.matchesUpdated > 0 || result.newlyScored > 0) {
    await logSync(result);
  }

  return result;
}

// ─── Bracket slot lookup ──────────────────────────────────────────────────────
//
// R16 slots are fixed (set manually after the R32 draw was confirmed).
// QF / SF / Final / 3rd-place slots are assigned automatically:
//   the Nth new match created in a stage gets slot N.
//   The football-data.org API returns matches in chronological bracket order,
//   so this naturally maps to the correct bracket positions without any
//   hardcoded fixture IDs.

const R16_BRACKET_SLOT_MAP: Record<number, number> = {
  537375: 1, // Paraguay vs France
  537376: 2, // Canada vs Morocco
  537377: 3, // Brazil vs Norway
  537378: 4, // Mexico vs England
  537379: 5, // Portugal vs Spain
  537380: 6, // United States vs Belgium
  537381: 7, // Argentina vs Egypt
  537382: 8, // Switzerland vs Colombia
};

// Stages where bracketSlot is auto-assigned (QF and later)
const AUTO_SLOT_STAGES = new Set(['QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'THIRD_PLACE']);

// ─── Core fixture processing ──────────────────────────────────────────────────

async function processFixtures(fixtures: ApiFixture[], result: SyncResult): Promise<number> {
  let updated = 0;

  for (const fixture of fixtures) {
    try {
      await processOneFixture(fixture, result);
      updated++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Fixture ${fixture.fixture.id}: ${msg}`);
    }
  }

  return updated;
}

async function processOneFixture(fixture: ApiFixture, result: SyncResult): Promise<void> {
  const { stage, groupRound } = mapStage(fixture.league.round);
  const newStatus = mapStatus(fixture.fixture.status.short);

  // ── Resolve home and away teams ──────────────────────────────────────────
  const homeTeam = await resolveTeam(fixture.teams.home.id, fixture.teams.home.name);
  const awayTeam = await resolveTeam(fixture.teams.away.id, fixture.teams.away.name);

  if (!homeTeam || !awayTeam) {
    // Teams not yet in DB (unlikely but safe to skip)
    return;
  }

  // ── Build score values ────────────────────────────────────────────────────
  // For PENALTY_SHOOTOUT matches football-data.org fullTime is the cumulative total
  // (regularTime + extraTime + penaltyGoals).  We want the 120-minute score only.
  // This correction mirrors the one in footballApi.ts but lives here too so that
  // the sync is correct regardless of which layer deploys first.
  let homeScore: number | null;
  let awayScore: number | null;

  if (
    fixture.score.duration === 'PENALTY_SHOOTOUT' &&
    fixture.score.regularTime?.home !== undefined &&
    fixture.score.regularTime?.home !== null
  ) {
    homeScore = (fixture.score.regularTime.home ?? 0) + (fixture.score.extratime?.home ?? 0);
    awayScore = (fixture.score.regularTime.away ?? 0) + (fixture.score.extratime?.away ?? 0);
  } else {
    homeScore = fixture.score.fulltime.home ?? fixture.goals.home;
    awayScore = fixture.score.fulltime.away ?? fixture.goals.away;
  }

  // ── Find existing match by externalId, or by team pair ───────────────────
  // First try by external ID — this is reliable and prevents a cross-stage collision
  // where two teams meet in the group stage AND again in the knockouts.
  let existingMatch = await prisma.match.findFirst({
    where: { externalId: fixture.fixture.id },
  });
  // Only fall back to team-pair for records that haven't been linked to an externalId yet.
  if (!existingMatch) {
    existingMatch = await prisma.match.findFirst({
      where: { homeTeamId: homeTeam.id, awayTeamId: awayTeam.id, externalId: null },
    });
  }

  if (existingMatch) {
    const wasFinished = existingMatch.status === 'FINISHED';

    // Once a match is already FINISHED we keep the stored score as-is.
    // Overwriting it on every sync would undo manual corrections (e.g. stripping
    // penalty-shootout goals from the stored score) and can mis-score bets that
    // were already awarded under the correct value.
    // Score is only written when the match is transitioning INTO finished state
    // (wasFinished=false) or is still in progress.
    const scoreUpdate = wasFinished
      ? {}
      : { homeScore, awayScore };

    await prisma.match.update({
      where: { id: existingMatch.id },
      data: {
        externalId:  fixture.fixture.id,
        matchDate:   new Date(fixture.fixture.date),
        venue:       fixture.fixture.venue.name ?? existingMatch.venue,
        stage:       stage as any,
        // For GROUP stage keep the round number; for all knockout stages always null
        groupRound:  stage === 'GROUP' ? (groupRound ?? existingMatch.groupRound) : null,
        ...scoreUpdate,
        status:      newStatus,
        // Update team IDs in case the draw changed something
        homeTeamId:  homeTeam.id,
        awayTeamId:  awayTeam.id,
      },
    });

    // Auto-score if this match just became FINISHED
    if (!wasFinished && newStatus === 'FINISHED' && homeScore !== null && awayScore !== null) {
      try {
        await scoreMatch(existingMatch.id);
        result.newlyScored++;
        console.log(`[Sync] Scored match ${existingMatch.id}: ${homeTeam.name} ${homeScore}–${awayScore} ${awayTeam.name}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Scoring match ${existingMatch.id}: ${msg}`);
      }
    }
  } else {
    // New match (knockout stage matches appear here as tournament progresses)

    // Determine bracket slot:
    //   R16 → fixed map (slots confirmed after R32 draw)
    //   QF / SF / Final / 3rd Place → auto-assign as Nth match in that stage.
    //   The API always returns matches in chronological bracket order, so
    //   the 1st QF match created = slot 1, 2nd = slot 2, etc.
    let bracketSlot: number | null = R16_BRACKET_SLOT_MAP[fixture.fixture.id] ?? null;
    if (bracketSlot === null && AUTO_SLOT_STAGES.has(stage)) {
      const existingCount = await prisma.match.count({ where: { stage: stage as any } });
      bracketSlot = existingCount + 1;
    }

    await prisma.match.create({
      data: {
        externalId:  fixture.fixture.id,
        homeTeamId:  homeTeam.id,
        awayTeamId:  awayTeam.id,
        stage:       stage as any,
        groupRound:  groupRound,
        matchDate:   new Date(fixture.fixture.date),
        venue:       fixture.fixture.venue.name ?? undefined,
        homeScore:   homeScore,
        awayScore:   awayScore,
        status:      newStatus,
        bracketSlot,
      },
    });
    console.log(`[Sync] Created ${stage} match slot=${bracketSlot}: ${homeTeam.name} vs ${awayTeam.name}`);
  }
}

// ─── Team resolution ──────────────────────────────────────────────────────────

async function resolveTeam(apiId: number, apiName: string) {
  // Knockout fixtures have TBD slots with no ID yet — skip them
  if (!apiId || !apiName || apiName === 'TBD') return null;

  // First try by external ID (fastest, most reliable)
  const byId = await prisma.team.findUnique({ where: { externalId: apiId } });
  if (byId) return byId;

  // Fall back to name matching (and link the external ID for future syncs)
  const normName = normaliseTeamName(apiName);
  const byName = await prisma.team.findFirst({
    where: {
      OR: [
        { name: { equals: normName, mode: 'insensitive' } },
        { name: { equals: apiName,  mode: 'insensitive' } },
      ],
    },
  });

  if (byName) {
    // Link external ID now so next sync is faster
    await prisma.team.update({
      where: { id: byName.id },
      data: { externalId: apiId },
    });
    return byName;
  }

  // Team not found — create it (happens for playoff/intercontinental teams)
  console.warn(`[Sync] Unknown team "${apiName}" (id ${apiId}) — creating placeholder`);
  return await prisma.team.create({
    data: {
      externalId: apiId,
      name:  normName,
      code:  apiName.slice(0, 3).toUpperCase(),
      group: 'TBD',
    },
  });
}

// ─── Logging ──────────────────────────────────────────────────────────────────

async function logSync(result: SyncResult): Promise<void> {
  await prisma.syncLog.create({
    data: {
      matchesUpdated: result.matchesUpdated,
      newlyScored:    result.newlyScored,
      error:          result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
    },
  });
}

export async function getLastSync() {
  return prisma.syncLog.findFirst({ orderBy: { syncedAt: 'desc' } });
}

// ─── Player sync ──────────────────────────────────────────────────────────────
//
// Pulls all WC 2026 squads from the API (1 call) and upserts players into the DB.
// Safe to re-run — uses externalId for deduplication.

export async function syncPlayers(): Promise<number> {
  const teamsWithSquads = await fetchAllSquads();
  let synced = 0;

  for (const entry of teamsWithSquads) {
    // Find the DB team by external API id
    const dbTeam = await prisma.team.findUnique({ where: { externalId: entry.team.id } });
    if (!dbTeam) continue; // team not yet linked — run a full fixture sync first

    for (const player of entry.squad) {
      await prisma.player.upsert({
        where: { externalId: player.id },
        update: { name: player.name, position: player.position, teamId: dbTeam.id },
        create: { externalId: player.id, name: player.name, position: player.position, teamId: dbTeam.id },
      });
      synced++;
    }
  }

  return synced;
}
