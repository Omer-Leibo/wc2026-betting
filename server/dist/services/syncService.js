"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkTeams = linkTeams;
exports.syncAllFixtures = syncAllFixtures;
exports.syncLiveFixtures = syncLiveFixtures;
exports.getLastSync = getLastSync;
exports.syncPlayers = syncPlayers;
const prisma_1 = require("../lib/prisma");
const footballApi_1 = require("./footballApi");
const scoring_1 = require("./scoring");
// ─── Team linking ─────────────────────────────────────────────────────────────
//
// On the first sync we try to link every API team to our DB team by name.
// Once linked (externalId set), future syncs use the ID directly.
async function linkTeams() {
    const apiTeams = await (0, footballApi_1.fetchTeams)();
    let linked = 0;
    for (const apiTeam of apiTeams) {
        const normName = (0, footballApi_1.normaliseTeamName)(apiTeam.team.name);
        // Try to find our team by name
        const dbTeam = await prisma_1.prisma.team.findFirst({
            where: {
                OR: [
                    { name: { equals: normName, mode: 'insensitive' } },
                    { name: { equals: apiTeam.team.name, mode: 'insensitive' } },
                ],
                externalId: null, // only re-link unlinked teams
            },
        });
        if (dbTeam) {
            await prisma_1.prisma.team.update({
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
async function syncAllFixtures() {
    const result = { matchesUpdated: 0, newlyScored: 0, teamsLinked: 0, errors: [] };
    try {
        result.teamsLinked = await linkTeams();
        const fixtures = await (0, footballApi_1.fetchAllFixtures)();
        result.matchesUpdated = await processFixtures(fixtures, result);
    }
    catch (err) {
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
async function syncLiveFixtures() {
    const result = { matchesUpdated: 0, newlyScored: 0, teamsLinked: 0, errors: [] };
    try {
        const fixtures = await (0, footballApi_1.fetchLiveFixtures)();
        if (fixtures.length > 0) {
            result.matchesUpdated = await processFixtures(fixtures, result);
        }
    }
    catch (err) {
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
// Maps football-data.org fixture IDs → our bracketSlot numbers.
// Add new entries here as each knockout round is scheduled by FIFA.
//
// R16 slots (1–8): determined after R32 results, Jul 4–7 2026
// QF  slots (1–4): will be added once QF schedule is confirmed
// SF  slots (1–2): will be added once SF schedule is confirmed
const BRACKET_SLOT_MAP = {
    // ── Round of 16 ──
    537375: 1, // Paraguay vs France
    537376: 2, // Canada vs Morocco
    537377: 3, // Brazil vs Norway
    537378: 4, // Mexico vs England
    537379: 5, // Portugal vs Spain
    537380: 6, // United States vs Belgium
    537381: 7, // Argentina vs Egypt
    537382: 8, // Switzerland vs Colombia
};
// ─── Core fixture processing ──────────────────────────────────────────────────
async function processFixtures(fixtures, result) {
    let updated = 0;
    for (const fixture of fixtures) {
        try {
            await processOneFixture(fixture, result);
            updated++;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`Fixture ${fixture.fixture.id}: ${msg}`);
        }
    }
    return updated;
}
async function processOneFixture(fixture, result) {
    const { stage, groupRound } = (0, footballApi_1.mapStage)(fixture.league.round);
    const newStatus = (0, footballApi_1.mapStatus)(fixture.fixture.status.short);
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
    let homeScore;
    let awayScore;
    if (fixture.score.duration === 'PENALTY_SHOOTOUT' &&
        fixture.score.regularTime?.home !== undefined &&
        fixture.score.regularTime?.home !== null) {
        homeScore = (fixture.score.regularTime.home ?? 0) + (fixture.score.extratime?.home ?? 0);
        awayScore = (fixture.score.regularTime.away ?? 0) + (fixture.score.extratime?.away ?? 0);
    }
    else {
        homeScore = fixture.score.fulltime.home ?? fixture.goals.home;
        awayScore = fixture.score.fulltime.away ?? fixture.goals.away;
    }
    // ── Find existing match by externalId, or by team pair ───────────────────
    // First try by external ID — this is reliable and prevents a cross-stage collision
    // where two teams meet in the group stage AND again in the knockouts.
    let existingMatch = await prisma_1.prisma.match.findFirst({
        where: { externalId: fixture.fixture.id },
    });
    // Only fall back to team-pair for records that haven't been linked to an externalId yet.
    if (!existingMatch) {
        existingMatch = await prisma_1.prisma.match.findFirst({
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
        await prisma_1.prisma.match.update({
            where: { id: existingMatch.id },
            data: {
                externalId: fixture.fixture.id,
                matchDate: new Date(fixture.fixture.date),
                venue: fixture.fixture.venue.name ?? existingMatch.venue,
                stage: stage,
                // For GROUP stage keep the round number; for all knockout stages always null
                groupRound: stage === 'GROUP' ? (groupRound ?? existingMatch.groupRound) : null,
                ...scoreUpdate,
                status: newStatus,
                // Update team IDs in case the draw changed something
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
            },
        });
        // Auto-score if this match just became FINISHED
        if (!wasFinished && newStatus === 'FINISHED' && homeScore !== null && awayScore !== null) {
            try {
                await (0, scoring_1.scoreMatch)(existingMatch.id);
                result.newlyScored++;
                console.log(`[Sync] Scored match ${existingMatch.id}: ${homeTeam.name} ${homeScore}–${awayScore} ${awayTeam.name}`);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                result.errors.push(`Scoring match ${existingMatch.id}: ${msg}`);
            }
        }
    }
    else {
        // New match (knockout stage matches appear here as tournament progresses)
        const bracketSlot = BRACKET_SLOT_MAP[fixture.fixture.id] ?? null;
        await prisma_1.prisma.match.create({
            data: {
                externalId: fixture.fixture.id,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                stage: stage,
                groupRound: groupRound,
                matchDate: new Date(fixture.fixture.date),
                venue: fixture.fixture.venue.name ?? undefined,
                homeScore: homeScore,
                awayScore: awayScore,
                status: newStatus,
                bracketSlot,
            },
        });
        if (bracketSlot) {
            console.log(`[Sync] Created ${stage} match slot=${bracketSlot}: ${homeTeam.name} vs ${awayTeam.name}`);
        }
    }
}
// ─── Team resolution ──────────────────────────────────────────────────────────
async function resolveTeam(apiId, apiName) {
    // Knockout fixtures have TBD slots with no ID yet — skip them
    if (!apiId || !apiName || apiName === 'TBD')
        return null;
    // First try by external ID (fastest, most reliable)
    const byId = await prisma_1.prisma.team.findUnique({ where: { externalId: apiId } });
    if (byId)
        return byId;
    // Fall back to name matching (and link the external ID for future syncs)
    const normName = (0, footballApi_1.normaliseTeamName)(apiName);
    const byName = await prisma_1.prisma.team.findFirst({
        where: {
            OR: [
                { name: { equals: normName, mode: 'insensitive' } },
                { name: { equals: apiName, mode: 'insensitive' } },
            ],
        },
    });
    if (byName) {
        // Link external ID now so next sync is faster
        await prisma_1.prisma.team.update({
            where: { id: byName.id },
            data: { externalId: apiId },
        });
        return byName;
    }
    // Team not found — create it (happens for playoff/intercontinental teams)
    console.warn(`[Sync] Unknown team "${apiName}" (id ${apiId}) — creating placeholder`);
    return await prisma_1.prisma.team.create({
        data: {
            externalId: apiId,
            name: normName,
            code: apiName.slice(0, 3).toUpperCase(),
            group: 'TBD',
        },
    });
}
// ─── Logging ──────────────────────────────────────────────────────────────────
async function logSync(result) {
    await prisma_1.prisma.syncLog.create({
        data: {
            matchesUpdated: result.matchesUpdated,
            newlyScored: result.newlyScored,
            error: result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
        },
    });
}
async function getLastSync() {
    return prisma_1.prisma.syncLog.findFirst({ orderBy: { syncedAt: 'desc' } });
}
// ─── Player sync ──────────────────────────────────────────────────────────────
//
// Pulls all WC 2026 squads from the API (1 call) and upserts players into the DB.
// Safe to re-run — uses externalId for deduplication.
async function syncPlayers() {
    const teamsWithSquads = await (0, footballApi_1.fetchAllSquads)();
    let synced = 0;
    for (const entry of teamsWithSquads) {
        // Find the DB team by external API id
        const dbTeam = await prisma_1.prisma.team.findUnique({ where: { externalId: entry.team.id } });
        if (!dbTeam)
            continue; // team not yet linked — run a full fixture sync first
        for (const player of entry.squad) {
            await prisma_1.prisma.player.upsert({
                where: { externalId: player.id },
                update: { name: player.name, position: player.position, teamId: dbTeam.id },
                create: { externalId: player.id, name: player.name, position: player.position, teamId: dbTeam.id },
            });
            synced++;
        }
    }
    return synced;
}
//# sourceMappingURL=syncService.js.map