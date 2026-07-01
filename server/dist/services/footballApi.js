"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEAM_NAME_ALIASES = void 0;
exports.fetchAllFixtures = fetchAllFixtures;
exports.fetchLiveFixtures = fetchLiveFixtures;
exports.fetchTeams = fetchTeams;
exports.fetchAllSquads = fetchAllSquads;
exports.fetchQuota = fetchQuota;
exports.mapStatus = mapStatus;
exports.mapStage = mapStage;
exports.normaliseTeamName = normaliseTeamName;
const axios_1 = __importDefault(require("axios"));
// ─── football-data.org configuration ─────────────────────────────────────────
// Docs:     https://docs.football-data.org
// Free tier: 10 req/minute, includes FIFA World Cup — no daily cap
// Register: https://www.football-data.org/client/register  (instant, no card)
const API_BASE = 'https://api.football-data.org/v4';
// Override with FOOTBALL_API_COMPETITION=SA (or any code) in .env for test mode.
// Leave unset (or set to WC) for normal World Cup operation.
const COMPETITION = process.env.FOOTBALL_API_COMPETITION ?? 'WC';
function getClient() {
    const key = process.env.FOOTBALL_API_KEY;
    if (!key || key === 'your_football_data_key_here') {
        throw new Error('FOOTBALL_API_KEY is not set in .env');
    }
    const client = axios_1.default.create({
        baseURL: API_BASE,
        headers: { 'X-Auth-Token': key },
        timeout: 10000,
    });
    // Log the actual API error message (not just the HTTP status code)
    client.interceptors.response.use(res => res, err => {
        if (err.response) {
            const msg = err.response.data?.message ?? JSON.stringify(err.response.data);
            console.error(`[API] ${err.response.status} from ${err.config?.url ?? '?'}: ${msg}`);
            // Rethrow with a clearer message
            throw new Error(`football-data.org ${err.response.status}: ${msg}`);
        }
        throw err;
    });
    return client;
}
// ─── Adapter: football-data.org match → ApiFixture ────────────────────────────
function fdStatusToShort(status) {
    switch (status) {
        case 'FINISHED': return 'FT';
        case 'AWARDED': return 'FT';
        case 'IN_PLAY': return '1H';
        case 'PAUSED': return 'HT';
        case 'EXTRA_TIME': return 'ET';
        case 'PENALTY_SHOOTOUT': return 'P';
        default: return 'NS'; // SCHEDULED, TIMED, SUSPENDED, POSTPONED, CANCELLED
    }
}
function fdStageToRound(stage, matchday) {
    switch (stage) {
        case 'GROUP_STAGE': return `Group Stage - ${matchday ?? 1}`;
        case 'REGULAR_SEASON': return `Regular Season - ${matchday ?? 1}`;
        case 'ROUND_OF_32': return 'Round of 32';
        case 'LAST_32': return 'Round of 32'; // alt name some APIs use
        case 'LAST_16': return 'Round of 16';
        case 'ROUND_OF_16': return 'Round of 16';
        case 'QUARTER_FINALS': return 'Quarter-finals';
        case 'QUARTER_FINAL': return 'Quarter-finals';
        case 'SEMI_FINALS': return 'Semi-finals';
        case 'SEMI_FINAL': return 'Semi-finals';
        case 'THIRD_PLACE': return '3rd Place Final';
        case 'FINAL': return 'Final';
        default:
            console.warn(`[footballApi] Unknown stage from API: "${stage}" (matchday=${matchday})`);
            return `${stage} - ${matchday ?? 1}`;
    }
}
function mapFdMatchToApiFixture(m) {
    // For PENALTY_SHOOTOUT matches, score.fullTime is the cumulative total
    // (regularTime goals + extraTime goals + penalty goals), which is wrong for us.
    // We want the 120-minute score only: regularTime + extraTime (no pens).
    // For REGULAR and EXTRA_TIME matches, fullTime is already correct.
    let scoreHome;
    let scoreAway;
    if (m.score.duration === 'PENALTY_SHOOTOUT' && m.score.regularTime) {
        const rtH = m.score.regularTime.home ?? 0;
        const rtA = m.score.regularTime.away ?? 0;
        const etH = m.score.extraTime?.home ?? 0;
        const etA = m.score.extraTime?.away ?? 0;
        scoreHome = rtH + etH;
        scoreAway = rtA + etA;
    }
    else {
        scoreHome = m.score.fullTime.home;
        scoreAway = m.score.fullTime.away;
    }
    return {
        fixture: {
            id: m.id,
            date: m.utcDate,
            status: { short: fdStatusToShort(m.status), elapsed: null },
            venue: { name: m.venue ?? null, city: null },
        },
        league: {
            id: 2000,
            round: fdStageToRound(m.stage, m.matchday),
        },
        teams: {
            home: { id: m.homeTeam.id, name: m.homeTeam.name, logo: m.homeTeam.crest },
            away: { id: m.awayTeam.id, name: m.awayTeam.name, logo: m.awayTeam.crest },
        },
        goals: {
            home: scoreHome,
            away: scoreAway,
        },
        score: {
            duration: m.score.duration,
            fulltime: { home: scoreHome, away: scoreAway },
            extratime: { home: m.score.extraTime?.home ?? null, away: m.score.extraTime?.away ?? null },
            penalty: { home: m.score.penalties?.home ?? null, away: m.score.penalties?.away ?? null },
            regularTime: m.score.regularTime
                ? { home: m.score.regularTime.home, away: m.score.regularTime.away }
                : undefined,
        },
    };
}
// ─── Public API functions ─────────────────────────────────────────────────────
/** Fetch fixtures for the active competition.
 *  For WC: all matches (104).
 *  For test competitions (SA, PL, etc.): only from today onwards so we don't
 *  flood the DB with a full season of historical matches. */
async function fetchAllFixtures() {
    const client = getClient();
    const params = {};
    if (COMPETITION !== 'WC') {
        // Limit to today onwards so we don't import the entire season history.
        // Also include the current season year so the API doesn't reject the request
        // when the competition year is ambiguous (avoids 400 errors).
        // football-data.org requires dateFrom and dateTo together.
        // Pull a 14-day window from today so we get upcoming fixtures to bet on.
        const from = new Date();
        const to = new Date();
        to.setDate(to.getDate() + 14);
        params.dateFrom = from.toISOString().slice(0, 10); // YYYY-MM-DD
        params.dateTo = to.toISOString().slice(0, 10);
        params.season = String(new Date().getFullYear() - 1); // e.g. 2025 for 2025-26 season
    }
    const resp = await client.get(`/competitions/${COMPETITION}/matches`, { params });
    const matches = resp.data.matches ?? [];
    return matches.map(mapFdMatchToApiFixture);
}
/**
 * Fetch today's matches that are live or already finished.
 * 1 request per poll — very quota-friendly.
 */
async function fetchLiveFixtures() {
    const client = getClient();
    // Include yesterday so a match that kicked off near midnight UTC isn't missed
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const params = { dateFrom: yesterday, dateTo: today };
    if (COMPETITION !== 'WC') {
        params.season = String(new Date().getFullYear() - 1);
    }
    const resp = await client.get(`/competitions/${COMPETITION}/matches`, { params });
    const matches = resp.data.matches ?? [];
    const liveOrDone = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT', 'FINISHED', 'AWARDED'];
    return matches
        .filter(m => liveOrDone.includes(m.status))
        .map(mapFdMatchToApiFixture);
}
/** Fetch all teams registered for the active competition */
async function fetchTeams() {
    const client = getClient();
    const params = {};
    if (COMPETITION !== 'WC') {
        params.season = String(new Date().getFullYear() - 1);
    }
    const resp = await client.get(`/competitions/${COMPETITION}/teams`, { params });
    const teams = resp.data.teams ?? [];
    return teams.map(t => ({
        team: { id: t.id, name: t.name, code: t.tla, logo: t.crest },
        venue: { name: '' },
    }));
}
async function fetchAllSquads() {
    const client = getClient();
    const params = {};
    if (COMPETITION !== 'WC') {
        params.season = String(new Date().getFullYear() - 1);
    }
    const resp = await client.get(`/competitions/${COMPETITION}/teams`, { params });
    const raw = resp.data.teams ?? [];
    return raw.map((t) => ({
        team: { id: t.id, name: t.name, code: t.tla, logo: t.crest },
        venue: { name: '' },
        squad: (t.squad ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position ?? null,
        })),
    }));
}
/**
 * football-data.org doesn't expose a quota endpoint.
 * Free plan: 10 req/min (no daily cap).
 * Returns a placeholder so the Admin sync panel still renders.
 */
async function fetchQuota() {
    return { current: 0, limit: 600 }; // 600 = 10/min × 60min
}
// ─── Mapping helpers ──────────────────────────────────────────────────────────
/** Map short status code → our MatchStatus */
function mapStatus(apiStatus) {
    const finished = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
    const live = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'];
    if (finished.includes(apiStatus))
        return 'FINISHED';
    if (live.includes(apiStatus))
        return 'LIVE';
    return 'UPCOMING';
}
/** Map round string → our Stage enum + groupRound */
function mapStage(round) {
    const r = round.toLowerCase();
    if (r.includes('group stage') || r.includes('regular season')) {
        const m = round.match(/(\d+)\s*$/);
        return { stage: 'GROUP', groupRound: m ? parseInt(m[1]) : null };
    }
    if (r.includes('round of 32') || r.includes('last 32') || r.includes('last_32'))
        return { stage: 'ROUND_OF_32', groupRound: null };
    if (r.includes('round of 16') || r.includes('last 16') || r.includes('last_16'))
        return { stage: 'ROUND_OF_16', groupRound: null };
    if (r.includes('quarter'))
        return { stage: 'QUARTER_FINAL', groupRound: null };
    if (r.includes('semi'))
        return { stage: 'SEMI_FINAL', groupRound: null };
    if (r.includes('3rd') || r.includes('third') || r.includes('place'))
        return { stage: 'THIRD_PLACE', groupRound: null };
    if (r.includes('final'))
        return { stage: 'FINAL', groupRound: null };
    // Unknown stage — log a warning and assume GROUP only for genuine group-like strings
    console.warn(`[footballApi] mapStage: unrecognized round string "${round}" — defaulting to GROUP`);
    return { stage: 'GROUP', groupRound: null };
}
/**
 * football-data.org team names vs our seeded names.
 * Add entries here after the first sync if any names don't match.
 */
exports.TEAM_NAME_ALIASES = {
    'Korea Republic': 'South Korea',
    'Republic of Korea': 'South Korea',
    "Côte d'Ivoire": 'Ivory Coast',
    "Cote d'Ivoire": 'Ivory Coast',
    'IR Iran': 'Iran',
    'Bosnia and Herzegovina': 'Bosnia',
    'United States': 'United States',
    'USA': 'United States',
};
function normaliseTeamName(apiName) {
    return exports.TEAM_NAME_ALIASES[apiName] ?? apiName;
}
//# sourceMappingURL=footballApi.js.map