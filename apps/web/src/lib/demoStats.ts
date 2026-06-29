/*
 * DemoStats — the single, quarantined home for figures the API does NOT back yet
 * (admin-board pick %, landing/registration tiles).
 * Decision: mock client-side behind a swappable seam (frontend-roadmap "Resolved decisions" #3).
 *
 * Rules:
 *  - Real API data NEVER mixes with these in the query layer — mocked values live only here.
 *  - Every on-screen use is wrapped in <Demo> so it reads as placeholder, not real.
 *  - When a real endpoint lands, replace the matching field here; the call sites stay put.
 *
 * Now API-backed (mocks removed): league position trend (LeaderboardEntry.movement) and per-round
 * public ownership/recap (GET /rounds/{id}/stats — lock-gated). The admin price board's per-row pick %
 * stays mocked: it's a pre-lock screen, where real ownership is deliberately hidden (anti-copy gate).
 */
/** Mocked pick-% (ownership) for the admin price board — no aggregate pick counts endpoint yet. */
export function mockPickPct(entityId: number): number {
  return [42, 8, 23, 3, 61, 15, 31, 5, 12, 49, 27, 1][entityId % 12]
}

export const demoStats = {
  // Landing "Players"/"Leagues" tiles are now API-backed via GET /stats (see useGlobalStats).
  // Admin Registrations summary tiles — no aggregate pick-set / league-count endpoints yet.
  registrations: { picksSetPct: 80, privateLeagues: 412 },
}
