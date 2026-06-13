/**
 * WC 2026 Round of 32 official bracket pairings
 *
 * Source: FIFA / ESPN official match schedule
 * Positions: "1X" = 1st place Group X, "2X" = 2nd place Group X
 *            "3rd" = one of the 8 best 3rd-placed teams (slot TBD until group stage ends)
 *
 * Match order follows the official tournament slot numbering (1 = Jun 28, 16 = Jul 3).
 * The admin assigns `bracketSlot` on each DB match to link it here.
 */

export interface R32Pairing {
  slot: number;    // 1–16 (must match the bracketSlot stored in DB)
  homePos: string; // e.g. "1A", "2B", "3rd"
  awayPos: string;
}

export const R32_BRACKET: R32Pairing[] = [
  { slot: 1,  homePos: '2A', awayPos: '2B'  }, // Jun 28 · Inglewood
  { slot: 2,  homePos: '1C', awayPos: '2F'  }, // Jun 29 · Houston
  { slot: 3,  homePos: '1E', awayPos: '3rd' }, // Jun 29 · Foxborough
  { slot: 4,  homePos: '1F', awayPos: '2C'  }, // Jun 29 · Guadalajara
  { slot: 5,  homePos: '2E', awayPos: '2I'  }, // Jun 30 · Arlington
  { slot: 6,  homePos: '1I', awayPos: '3rd' }, // Jun 30 · East Rutherford
  { slot: 7,  homePos: '1A', awayPos: '3rd' }, // Jun 30 · Mexico City
  { slot: 8,  homePos: '1L', awayPos: '3rd' }, // Jul 1  · Atlanta
  { slot: 9,  homePos: '1G', awayPos: '3rd' }, // Jul 1  · Seattle
  { slot: 10, homePos: '1D', awayPos: '3rd' }, // Jul 1  · Santa Clara
  { slot: 11, homePos: '1H', awayPos: '2J'  }, // Jul 2  · Inglewood
  { slot: 12, homePos: '2K', awayPos: '2L'  }, // Jul 2  · Toronto
  { slot: 13, homePos: '1B', awayPos: '3rd' }, // Jul 2  · Vancouver
  { slot: 14, homePos: '2D', awayPos: '2G'  }, // Jul 3  · Arlington
  { slot: 15, homePos: '1J', awayPos: '2H'  }, // Jul 3  · Miami Gardens
  { slot: 16, homePos: '1K', awayPos: '3rd' }, // Jul 3  · Kansas City
];
