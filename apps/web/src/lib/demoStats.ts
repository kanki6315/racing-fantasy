/*
 * DemoStats — the single, quarantined home for figures the API does NOT back yet
 * (ownership %, average points, leaderboard trend, landing stat tiles, aggregate counts).
 * Decision: mock client-side behind a swappable seam (frontend-roadmap "Resolved decisions" #3).
 *
 * Rules:
 *  - Real API data NEVER mixes with these in the query layer — mocked values live only here.
 *  - Every on-screen use is wrapped in <Demo> so it reads as placeholder, not real.
 *  - When a real endpoint lands, replace the matching field here; the call sites stay put.
 */
/** Mocked league position trend (▲/▼/—) — the API has no round-over-round movement yet. */
export function mockTrend(leagueId: number): number {
  return [2, 6, 0, -3, 1, -1, 4][leagueId % 7]
}

/** Mocked pick-% (ownership) for the admin price board — no aggregate pick counts endpoint yet. */
export function mockPickPct(entityId: number): number {
  return [42, 8, 23, 3, 61, 15, 31, 5, 12, 49, 27, 1][entityId % 12]
}

export const demoStats = {
  global: { players: 7482, leagues: 312 },

  // Admin Registrations summary tiles — no aggregate pick-set / league-count endpoints yet.
  registrations: { picksSetPct: 80, privateLeagues: 412 },

  // Landing hero "next round" — until we read the real next round + client-side lock countdown (F2/F3).
  nextRound: {
    badge: 'RD 07 — WEATHERTECH',
    title: 'Six Hours of The Glen',
    where: 'Watkins Glen International · Jun 28',
    lock: '07d 11h 51m',
  },

  // Landing season calendar rows.
  calendar: [
    { round: 'R07', name: 'Watkins Glen', series: 'WeatherTech · 6H', date: 'JUN 28', status: 'PICKS OPEN', lock: '7d 11h' },
    { round: 'R05', name: 'Road America', series: 'MX-5 Cup · Sprint', date: 'JUL 12', status: 'OPENS SOON', lock: '14d' },
    { round: 'R06', name: 'VIR', series: 'Carrera Cup · Pro / Pro-Am', date: 'JUL 19', status: 'OPENS SOON', lock: '21d' },
    { round: 'R08', name: 'Mosport', series: 'WeatherTech · 2H40', date: 'AUG 09', status: 'SCHEDULED', lock: '42d' },
  ],
}
