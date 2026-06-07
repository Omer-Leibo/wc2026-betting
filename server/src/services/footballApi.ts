import axios from 'axios';

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
  const client = axios.create({
    baseURL: API_BASE,
    headers: { 'X-Auth-Token': key },
    timeout: 10000,
  });

  // Log the actual API error message (not just the HTTP status code)
  client.interceptors.response.use(
    res => res,
    err => {
      if (err.response) {
        const msg = err.response.data?.message ?? JSON.stringify(err.response.data);
        console.error(`[API] ${err.response.status} from ${err.config?.url ?? '?'}: ${msg}`);
        // Rethrow with a clearer message
        throw new Error(`football-data.org ${err.response.status}: ${msg}`);
      }
      throw err;
    },
  );

  return client;
}

// ─── football-data.org raw response types ─────────────────────────────────────

interface FdTeamRef {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;        // SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, EXTRA_TIME,
                         // PENALTY_SHOOTOUT, SUSPENDED, POSTPONED, CANCELLED, AWARDED
  matchday: number | null;
  stage: string;         // GROUP_STAGE, ROUND_OF_32, LAST_16, QUARTER_FINALS,
                         // SEMI_FINALS, THIRD_PLACE, FINAL
  group: string | null;  // GROUP_A … GROUP_L  (null for knockout rounds)
  homeTeam: FdTeamRef;
  awayTeam: FdTeamRef;
  score: {
    winner: string | null; // HOME_TEAM | AWAY_TEAM | DRAW | null
    duration: string;      // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
    fullTime:  { home: number | null; away: number | null };
    halfTime:  { home: number | null; away: number | null };
  };
  venue: string | null;
}

interface FdTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

// ─── Public types — same shape as before so syncService.ts needs no changes ───

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { name: string | null; city: string | null };
  };
  league: { id: number; round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    fulltime:  { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty:   { home: number | null; away: number | null };
  };
}

export interface ApiTeam {
  team: { id: number; name: string; code: string; logo: string };
  venue: { name: string };
}

// ─── Adapter: football-data.org match → ApiFixture ────────────────────────────

function fdStatusToShort(status: string): string {
  switch (status) {
    case 'FINISHED':           return 'FT';
    case 'AWARDED':            return 'FT';
    case 'IN_PLAY':            return '1H';
    case 'PAUSED':             return 'HT';
    case 'EXTRA_TIME':         return 'ET';
    case 'PENALTY_SHOOTOUT':   return 'P';
    default:                   return 'NS'; // SCHEDULED, TIMED, SUSPENDED, POSTPONED, CANCELLED
  }
}

function fdStageToRound(stage: string, matchday: number | null): string {
  switch (stage) {
    case 'GROUP_STAGE':      return `Group Stage - ${matchday ?? 1}`;
    case 'REGULAR_SEASON':   return `Regular Season - ${matchday ?? 1}`;
    case 'ROUND_OF_32':      return 'Round of 32';
    case 'LAST_16':          return 'Round of 16';
    case 'ROUND_OF_16':      return 'Round of 16';
    case 'QUARTER_FINALS':   return 'Quarter-finals';
    case 'SEMI_FINALS':      return 'Semi-finals';
    case 'THIRD_PLACE':      return '3rd Place Final';
    case 'FINAL':            return 'Final';
    default:                 return `${stage} - ${matchday ?? 1}`;
  }
}

function mapFdMatchToApiFixture(m: FdMatch): ApiFixture {
  return {
    fixture: {
      id:     m.id,
      date:   m.utcDate,
      status: { short: fdStatusToShort(m.status), elapsed: null },
      venue:  { name: m.venue ?? null, city: null },
    },
    league: {
      id:    2000,
      round: fdStageToRound(m.stage, m.matchday),
    },
    teams: {
      home: { id: m.homeTeam.id, name: m.homeTeam.name, logo: m.homeTeam.crest },
      away: { id: m.awayTeam.id, name: m.awayTeam.name, logo: m.awayTeam.crest },
    },
    goals: {
      home: m.score.fullTime.home,
      away: m.score.fullTime.away,
    },
    score: {
      fulltime:  { home: m.score.fullTime.home,  away: m.score.fullTime.away },
      extratime: { home: null, away: null },
      penalty:   { home: null, away: null },
    },
  };
}

// ─── Public API functions ─────────────────────────────────────────────────────

/** Fetch fixtures for the active competition.
 *  For WC: all matches (104).
 *  For test competitions (SA, PL, etc.): only from today onwards so we don't
 *  flood the DB with a full season of historical matches. */
export async function fetchAllFixtures(): Promise<ApiFixture[]> {
  const client = getClient();
  const params: Record<string, string> = {};
  if (COMPETITION !== 'WC') {
    // Limit to today onwards so we don't import the entire season history.
    // Also include the current season year so the API doesn't reject the request
    // when the competition year is ambiguous (avoids 400 errors).
    // football-data.org requires dateFrom and dateTo together.
    // Pull a 14-day window from today so we get upcoming fixtures to bet on.
    const from = new Date();
    const to   = new Date(); to.setDate(to.getDate() + 14);
    params.dateFrom = from.toISOString().slice(0, 10); // YYYY-MM-DD
    params.dateTo   = to.toISOString().slice(0, 10);
    params.season   = String(new Date().getFullYear() - 1);  // e.g. 2025 for 2025-26 season
  }
  const resp = await client.get(`/competitions/${COMPETITION}/matches`, { params });
  const matches: FdMatch[] = resp.data.matches ?? [];
  return matches.map(mapFdMatchToApiFixture);
}

/**
 * Fetch today's matches that are live or already finished.
 * 1 request per poll — very quota-friendly.
 */
export async function fetchLiveFixtures(): Promise<ApiFixture[]> {
  const client = getClient();
  // Include yesterday so a match that kicked off near midnight UTC isn't missed
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const today     = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const params: Record<string, string> = { dateFrom: yesterday, dateTo: today };
  if (COMPETITION !== 'WC') {
    params.season = String(new Date().getFullYear() - 1);
  }
  const resp = await client.get(`/competitions/${COMPETITION}/matches`, { params });
  const matches: FdMatch[] = resp.data.matches ?? [];
  const liveOrDone = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT', 'FINISHED', 'AWARDED'];
  return matches
    .filter(m => liveOrDone.includes(m.status))
    .map(mapFdMatchToApiFixture);
}

/** Fetch all teams registered for the active competition */
export async function fetchTeams(): Promise<ApiTeam[]> {
  const client = getClient();
  const params: Record<string, string> = {};
  if (COMPETITION !== 'WC') {
    params.season = String(new Date().getFullYear() - 1);
  }
  const resp = await client.get(`/competitions/${COMPETITION}/teams`, { params });
  const teams: FdTeam[] = resp.data.teams ?? [];
  return teams.map(t => ({
    team: { id: t.id, name: t.name, code: t.tla, logo: t.crest },
    venue: { name: '' },
  }));
}

/**
 * Fetch all WC 2026 teams INCLUDING their full squad.
 * Uses the /competitions/WC/teams endpoint which returns squad arrays.
 * 1 API call covers all 48 teams.
 */
export interface ApiSquadPlayer {
  id: number;
  name: string;
  position: string | null;
}
export interface ApiTeamWithSquad extends ApiTeam {
  squad: ApiSquadPlayer[];
}

export async function fetchAllSquads(): Promise<ApiTeamWithSquad[]> {
  const client = getClient();
  const params: Record<string, string> = {};
  if (COMPETITION !== 'WC') {
    params.season = String(new Date().getFullYear() - 1);
  }
  const resp = await client.get(`/competitions/${COMPETITION}/teams`, { params });
  const raw = resp.data.teams ?? [];
  return raw.map((t: any) => ({
    team: { id: t.id, name: t.name, code: t.tla, logo: t.crest },
    venue: { name: '' },
    squad: (t.squad ?? []).map((p: any) => ({
      id:       p.id,
      name:     p.name,
      position: p.position ?? null,
    })),
  }));
}

/**
 * football-data.org doesn't expose a quota endpoint.
 * Free plan: 10 req/min (no daily cap).
 * Returns a placeholder so the Admin sync panel still renders.
 */
export async function fetchQuota(): Promise<{ current: number; limit: number }> {
  return { current: 0, limit: 600 }; // 600 = 10/min × 60min
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/** Map short status code → our MatchStatus */
export function mapStatus(apiStatus: string): 'UPCOMING' | 'LIVE' | 'FINISHED' {
  const finished = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
  const live     = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'];
  if (finished.includes(apiStatus)) return 'FINISHED';
  if (live.includes(apiStatus))     return 'LIVE';
  return 'UPCOMING';
}

/** Map round string → our Stage enum + groupRound */
export function mapStage(round: string): { stage: string; groupRound: number | null } {
  const r = round.toLowerCase();
  if (r.includes('group stage') || r.includes('regular season')) {
    const m = round.match(/(\d+)\s*$/);
    return { stage: 'GROUP', groupRound: m ? parseInt(m[1]) : null };
  }
  if (r.includes('round of 32'))                                        return { stage: 'ROUND_OF_32',    groupRound: null };
  if (r.includes('round of 16'))                                        return { stage: 'ROUND_OF_16',    groupRound: null };
  if (r.includes('quarter'))                                            return { stage: 'QUARTER_FINAL',  groupRound: null };
  if (r.includes('semi'))                                               return { stage: 'SEMI_FINAL',     groupRound: null };
  if (r.includes('3rd') || r.includes('third') || r.includes('place')) return { stage: 'THIRD_PLACE',    groupRound: null };
  if (r.includes('final'))                                              return { stage: 'FINAL',          groupRound: null };
  return { stage: 'GROUP', groupRound: null };
}

/**
 * football-data.org team names vs our seeded names.
 * Add entries here after the first sync if any names don't match.
 */
export const TEAM_NAME_ALIASES: Record<string, string> = {
  'Korea Republic':         'South Korea',
  'Republic of Korea':      'South Korea',
  "Côte d'Ivoire":          'Ivory Coast',
  "Cote d'Ivoire":          'Ivory Coast',
  'IR Iran':                'Iran',
  'Bosnia and Herzegovina': 'Bosnia',
  'United States':          'United States',
  'USA':                    'United States',
};

export function normaliseTeamName(apiName: string): string {
  return TEAM_NAME_ALIASES[apiName] ?? apiName;
}
