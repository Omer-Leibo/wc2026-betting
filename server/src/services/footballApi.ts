import axios from 'axios';

// ─── API-Football configuration ───────────────────────────────────────────────
// Docs: https://www.api-football.com/documentation-v3
// Free tier: 100 requests/day at api-sports.io

const API_BASE = 'https://v3.football.api-sports.io';
const WC_LEAGUE_ID = 1;    // FIFA World Cup
const WC_SEASON = 2026;

function getClient() {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key || key === 'your_api_football_key_here') {
    throw new Error('FOOTBALL_API_KEY is not set in .env');
  }
  return axios.create({
    baseURL: API_BASE,
    headers: { 'x-apisports-key': key },
    timeout: 10000,
  });
}

// ─── Types matching the API-Football v3 response ──────────────────────────────

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;         // ISO 8601
    status: {
      short: string;      // NS, 1H, HT, 2H, ET, P, FT, AET, PEN, PST, CANC, ABD, AWD, WO, LIVE
      elapsed: number | null;
    };
    venue: { name: string | null; city: string | null };
  };
  league: {
    id: number;
    round: string;        // "Group Stage - 1", "Round of 16", "Quarter-finals", etc.
  };
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

// ─── Public API functions ─────────────────────────────────────────────────────

/** Fetch all WC 2026 fixtures (up to 100 at a time; one page covers group stage) */
export async function fetchAllFixtures(): Promise<ApiFixture[]> {
  const client = getClient();
  const resp = await client.get('/fixtures', {
    params: { league: WC_LEAGUE_ID, season: WC_SEASON },
  });
  return resp.data.response as ApiFixture[];
}

/** Fetch only live / recently-finished fixtures (cheaper — 1 call) */
export async function fetchLiveFixtures(): Promise<ApiFixture[]> {
  const client = getClient();
  const resp = await client.get('/fixtures', {
    params: { league: WC_LEAGUE_ID, season: WC_SEASON, status: 'LIVE-FT-AET-PEN' },
  });
  return resp.data.response as ApiFixture[];
}

/** Fetch all teams in the WC 2026 */
export async function fetchTeams(): Promise<ApiTeam[]> {
  const client = getClient();
  const resp = await client.get('/teams', {
    params: { league: WC_LEAGUE_ID, season: WC_SEASON },
  });
  return resp.data.response as ApiTeam[];
}

/** Check remaining API quota */
export async function fetchQuota(): Promise<{ current: number; limit: number }> {
  const client = getClient();
  const resp = await client.get('/status');
  const sub = resp.data.response?.subscription;
  return {
    current: sub?.requests?.current ?? 0,
    limit: sub?.requests?.limit_day ?? 100,
  };
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/** Map API-Football fixture status → our MatchStatus */
export function mapStatus(apiStatus: string): 'UPCOMING' | 'LIVE' | 'FINISHED' {
  const finished = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
  const live     = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'];
  if (finished.includes(apiStatus)) return 'FINISHED';
  if (live.includes(apiStatus))     return 'LIVE';
  return 'UPCOMING';
}

/** Map API-Football round string → our Stage enum */
export function mapStage(round: string): { stage: string; groupRound: number | null } {
  const r = round.toLowerCase();
  if (r.includes('group stage') || r.includes('group stage - ')) {
    // e.g. "Group Stage - 1" or "Group Stage - Matchday 1"
    const match = round.match(/(\d+)\s*$/);
    const groupRound = match ? parseInt(match[1]) : null;
    return { stage: 'GROUP', groupRound };
  }
  if (r.includes('round of 32'))          return { stage: 'ROUND_OF_32',    groupRound: null };
  if (r.includes('round of 16'))          return { stage: 'ROUND_OF_16',    groupRound: null };
  if (r.includes('quarter'))              return { stage: 'QUARTER_FINAL',  groupRound: null };
  if (r.includes('semi'))                 return { stage: 'SEMI_FINAL',     groupRound: null };
  if (r.includes('3rd') || r.includes('third') || r.includes('place')) return { stage: 'THIRD_PLACE', groupRound: null };
  if (r.includes('final'))                return { stage: 'FINAL',          groupRound: null };
  return { stage: 'GROUP', groupRound: null }; // fallback
}

/**
 * API-Football uses different team names than what we may have seeded.
 * This map normalises common discrepancies.
 */
export const TEAM_NAME_ALIASES: Record<string, string> = {
  // API name → our DB name
  'Korea Republic':         'South Korea',
  'Republic of Korea':      'South Korea',
  'Ivory Coast':            "Ivory Coast",
  'Cote d\'Ivoire':         "Ivory Coast",
  "Côte d'Ivoire":          "Ivory Coast",
  'IR Iran':                'Iran',
  'USA':                    'United States',
  'United States':          'United States',
  'New Zealand':            'New Zealand',
  'Saudi Arabia':           'Saudi Arabia',
  'South Africa':           'South Africa',
  'Costa Rica':             'Costa Rica',
  'Bosnia and Herzegovina': 'Bosnia',
  // Add more as needed after first sync
};

export function normaliseTeamName(apiName: string): string {
  return TEAM_NAME_ALIASES[apiName] ?? apiName;
}
