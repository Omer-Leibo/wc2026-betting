/**
 * WC 2026 Round of 32 official bracket pairings
 *
 * Source: FIFA / ESPN official knockout schedule
 *
 * SLOT PAIRING RULE: consecutive slots (1+2, 3+4, 5+6 …) feed into the same R16 match.
 *
 *  Slots 1+2  → R16 slot 1  (Jul 4 · Philadelphia)    Germany/Paraguay vs France/Sweden
 *  Slots 3+4  → R16 slot 2  (Jul 4 · Houston)         South Africa/Canada vs Netherlands/Morocco
 *  Slots 5+6  → R16 slot 3  (Jul 5 · East Rutherford) Brazil/Japan vs Ivory Coast/Norway
 *  Slots 7+8  → R16 slot 4  (Jul 5 · Mexico City)     Mexico/Ecuador vs England/DR Congo
 *  Slots 9+10 → R16 slot 5  (Jul 6 · Arlington)       Portugal/Croatia vs Australia/Egypt
 *  Slots 11+12→ R16 slot 6  (Jul 6 · Seattle)         USA/Bosnia vs Belgium/Senegal
 *  Slots 13+14→ R16 slot 7  (Jul 7 · Atlanta)         Argentina/Cape Verde vs Colombia/Ghana
 *  Slots 15+16→ R16 slot 8  (Jul 7 · Vancouver)       Spain/Austria vs Switzerland/Algeria
 *
 * Positions:  "1X" = 1st place Group X,  "2X" = 2nd place Group X,  "3rd" = best 3rd-place
 *
 * Final group-stage positions (confirmed after Jun 27):
 *   Group A: Mexico (1st), South Africa (2nd)
 *   Group B: Switzerland (1st), Canada (2nd), Bosnia* (3rd-best)
 *   Group C: Brazil (1st), Morocco (2nd)
 *   Group D: USA (1st), Australia (2nd), Paraguay* (3rd-best)
 *   Group E: Germany (1st), Ivory Coast (2nd), Ecuador* (3rd-best)
 *   Group F: Netherlands (1st), Japan (2nd), Sweden* (3rd-best)
 *   Group G: Belgium (1st), Egypt (2nd)
 *   Group H: Spain (1st), Cape Verde (2nd)
 *   Group I: France (1st), Norway (2nd), Senegal* (3rd-best)
 *   Group J: Argentina (1st), Austria (2nd), Algeria* (3rd-best)
 *   Group K: Colombia (1st), Portugal (2nd), DR Congo* (3rd-best)
 *   Group L: England (1st), Croatia (2nd), Ghana* (3rd-best)
 *   (* = qualified as best 3rd-place finisher — shown as "3rd" label in bracket)
 */

export interface R32Pairing {
  slot: number;    // 1–16 (must match bracketSlot stored in DB)
  homePos: string; // e.g. "1A", "2B", "3rd"
  awayPos: string;
}

export const R32_BRACKET: R32Pairing[] = [
  // ── R16 slot 1 pair ──────────────────────────────────────────────────────────
  { slot: 1,  homePos: '1E',  awayPos: '3rd' }, // Jun 29 · Foxborough      — Germany vs Paraguay
  { slot: 2,  homePos: '1I',  awayPos: '3rd' }, // Jun 30 · E. Rutherford   — France vs Sweden

  // ── R16 slot 2 pair ──────────────────────────────────────────────────────────
  { slot: 3,  homePos: '2A',  awayPos: '2B'  }, // Jun 28 · Inglewood       — South Africa vs Canada
  { slot: 4,  homePos: '1F',  awayPos: '2C'  }, // Jun 29 · Monterrey       — Netherlands vs Morocco

  // ── R16 slot 3 pair ──────────────────────────────────────────────────────────
  { slot: 5,  homePos: '1C',  awayPos: '2F'  }, // Jun 29 · Houston         — Brazil vs Japan
  { slot: 6,  homePos: '2E',  awayPos: '2I'  }, // Jun 30 · Arlington       — Ivory Coast vs Norway

  // ── R16 slot 4 pair ──────────────────────────────────────────────────────────
  { slot: 7,  homePos: '1A',  awayPos: '3rd' }, // Jun 30 · Mexico City     — Mexico vs Ecuador
  { slot: 8,  homePos: '1L',  awayPos: '3rd' }, // Jul 1  · Atlanta         — England vs DR Congo

  // ── R16 slot 5 pair ──────────────────────────────────────────────────────────
  { slot: 9,  homePos: '2K',  awayPos: '2L'  }, // Jul 2  · Toronto         — Portugal vs Croatia
  { slot: 10, homePos: '2D',  awayPos: '2G'  }, // Jul 3  · Arlington       — Australia vs Egypt

  // ── R16 slot 6 pair ──────────────────────────────────────────────────────────
  { slot: 11, homePos: '1D',  awayPos: '3rd' }, // Jul 1  · Santa Clara     — USA vs Bosnia
  { slot: 12, homePos: '1G',  awayPos: '3rd' }, // Jul 1  · Seattle         — Belgium vs Senegal

  // ── R16 slot 7 pair ──────────────────────────────────────────────────────────
  { slot: 13, homePos: '1J',  awayPos: '2H'  }, // Jul 3  · Miami Gardens   — Argentina vs Cape Verde
  { slot: 14, homePos: '1K',  awayPos: '3rd' }, // Jul 3  · Kansas City     — Colombia vs Ghana

  // ── R16 slot 8 pair ──────────────────────────────────────────────────────────
  { slot: 15, homePos: '1H',  awayPos: '2J'  }, // Jul 2  · Inglewood       — Spain vs Austria
  { slot: 16, homePos: '1B',  awayPos: '3rd' }, // Jul 2  · Vancouver       — Switzerland vs Algeria
];
