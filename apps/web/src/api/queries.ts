import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './schema'

/** Query keys, centralized so mutations can invalidate precisely. */
export const qk = {
  championships: ['championships'] as const,
  seasons: ['seasons'] as const,
  activeSeason: ['active-season'] as const,
  me: ['auth', 'me'] as const,
}

// Response DTOs flow from the generated OpenAPI schema (no hand-mirrored bridge).
export type Championship = components['schemas']['ChampionshipDto']
export type Season = components['schemas']['SeasonDto']
export type Registration = components['schemas']['RegistrationDto']

/**
 * Fail a query on any non-2xx, including the ones that carry no body.
 *
 * `if (error) throw error` alone is not enough. When a request fails with an empty body — a 502 from
 * a proxy with the API down is the everyday case — there is nothing for the client to decode, so it
 * hands back `{ data: undefined, error: undefined }`. The guard doesn't fire, `data ?? []` resolves,
 * and the query *succeeds with an empty list*: the API being unreachable renders as "there are no
 * championships", identical to a genuinely empty database. Consulting `response.ok` closes that gap,
 * which is what makes an error state (and its retry) reachable at all.
 */
function assertOk(response: Response, error: unknown): void {
  if (error) throw error
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
}

export function useChampionships() {
  return useQuery({
    queryKey: qk.championships,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/championships')
      assertOk(response, error)
      return data ?? []
    },
  })
}

/**
 * The championship/season the landing + registration flow target. MVP: the first listed championship
 * that has a season (WeatherTech), newest year. Joining other series is a later dashboard action.
 */
export function useActiveSeason() {
  return useQuery({
    queryKey: qk.activeSeason,
    queryFn: async () => {
      const { data: champData, error: champErr } = await api.GET('/championships')
      if (champErr) throw champErr
      const { data: seasonData, error: seasonErr } = await api.GET('/seasons')
      if (seasonErr) throw seasonErr
      const champs = champData ?? []
      const seasons = seasonData ?? []
      for (const championship of champs) {
        const season = seasons
          .filter((s) => s.championshipId === championship.id)
          .sort((a, b) => b.year - a.year)[0]
        if (season) return { championship, season }
      }
      return null
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      seasonId: number
      teamName: string
      emailPreferences: { kind: string; enabled: boolean }[]
    }) => {
      const { data, error } = await api.POST('/registrations', { body: input })
      if (error) throw error
      return data as Registration
    },
    // Refetch identity so registrations[] (and the registrationId for picks) is current.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  })
}

/** Error carrying the HTTP status, so callers can branch on 429 (rate limit) etc. */
export class ApiError extends Error {
  status: number
  constructor(status: number) {
    super(`request failed (${status})`)
    this.status = status
  }
}

/** Per-kind email preference toggle (ADR-0009 amendment). Refetches /auth/me on success. */
export function useUpdateEmailPreference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { kind: string; enabled: boolean }) => {
      const { data, error, response } = await api.PUT('/auth/me/email-preferences', { body: input })
      if (error || !response.ok) throw new ApiError(response.status) // 429 = rate-limited (5/min)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  })
}

export function useAllSeasons() {
  return useQuery({
    queryKey: qk.seasons,
    queryFn: async () => {
      const { data, error } = await api.GET('/seasons')
      if (error) throw error
      return data ?? []
    },
  })
}

/** Seasons (years) for one championship — the Year level of the leaderboard's Champ → Year → Round filter. */
export function useSeasons(championshipId: number | undefined) {
  return useQuery({
    queryKey: ['seasons', championshipId],
    enabled: championshipId != null,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/seasons', { params: { query: { championshipId } } })
      assertOk(response, error)
      return data ?? []
    },
  })
}

// ---- Events (shared weekends, ADR-0007) ----
export type EventDto = components['schemas']['EventDto']

/** All shared race weekends, each carrying the championships (rounds) opted into it. Public. */
export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await api.GET('/events')
      if (error) throw error
      return data ?? []
    },
  })
}

// ---- Standings / leaderboards (F3) ----
export type LeaderboardEntry = components['schemas']['LeaderboardEntry']
export type SeasonLeaderboard = components['schemas']['SeasonLeaderboardResponse']
export type RoundLeaderboard = components['schemas']['RoundLeaderboardResponse']

export function useSeasonLeaderboard(seasonId: number | undefined) {
  return useQuery({
    queryKey: ['season-leaderboard', seasonId],
    enabled: seasonId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/seasons/{seasonId}/leaderboard', {
        params: { path: { seasonId: seasonId! } },
      })
      if (error) throw error
      return data!
    },
  })
}

export function useRoundLeaderboard(roundId: number | undefined) {
  return useQuery({
    queryKey: ['round-leaderboard', roundId],
    enabled: roundId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/rounds/{roundId}/leaderboard', {
        params: { path: { roundId: roundId! } },
      })
      if (error) throw error
      return data!
    },
  })
}

// ---- Round Recap stats (post-lock public aggregates) ----
export type RoundStats = components['schemas']['RoundStatsResponse']

/**
 * Round Recap aggregates (ownership %, best value, top bonus). The endpoint is lock-gated and returns
 * 409 until qualifying begins — we swallow that into `null` so the recap simply doesn't render before
 * lock, while real errors still surface. Cached client-side to match the 5-min server TTL.
 */
export function useRoundStats(roundId: number | undefined) {
  return useQuery({
    queryKey: ['round-stats', roundId],
    enabled: roundId != null,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/rounds/{roundId}/stats', {
        params: { path: { roundId: roundId! } },
      })
      if (error) {
        if (response.status === 409) return null // not locked yet — stats stay hidden
        throw error
      }
      return data!
    },
  })
}

// ---- Global stats (landing tiles) ----
export type GlobalStats = components['schemas']['GlobalStats']

export function useGlobalStats() {
  return useQuery({
    queryKey: ['global-stats'],
    staleTime: 5 * 60_000, // matches the server cache TTL; the figures are allowed to be slightly stale
    queryFn: async () => {
      const { data, error } = await api.GET('/stats')
      if (error) throw error
      return data!
    },
  })
}

// ---- Leagues (F3) ----
export type League = components['schemas']['LeagueDto']
export type LeagueLeaderboard = components['schemas']['LeagueLeaderboardResponse']

export function useMyLeagues() {
  return useQuery({
    queryKey: ['leagues', 'mine'],
    queryFn: async () => {
      const { data, error } = await api.GET('/leagues', { params: { query: { mine: true } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useDiscoverLeagues(seasonId: number | undefined) {
  return useQuery({
    queryKey: ['leagues', 'public', seasonId],
    enabled: seasonId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/leagues', { params: { query: { seasonId } } })
      if (error) throw error
      return (data ?? []).filter((l) => !l.isMember)
    },
  })
}

export function useLeague(id: number) {
  return useQuery({
    queryKey: ['league', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/leagues/{id}', { params: { path: { id } } })
      if (error) throw error
      return data!
    },
  })
}

/** League board, season-wide by default; pass a roundId to narrow to that single round (Total | round sub-filter). */
export function useLeagueLeaderboard(id: number, roundId?: number) {
  return useQuery({
    queryKey: ['league-leaderboard', id, roundId ?? 'season'],
    queryFn: async () => {
      const { data, error } = await api.GET('/leagues/{id}/leaderboard', {
        params: { path: { id }, query: { roundId } },
      })
      if (error) throw error
      return data!
    },
  })
}

export function useCreateLeague() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateLeague']) => {
      const { data, error } = await api.POST('/leagues', { body })
      if (error) throw error
      return data as League
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  })
}

export function useJoinLeague() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, joinCode }: { id: number; joinCode?: string }) => {
      const { error } = await api.POST('/leagues/{id}/join', {
        params: { path: { id }, query: { joinCode } },
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  })
}

export function useJoinByCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (joinCode: string) => {
      const { data, error } = await api.POST('/leagues/join', { params: { query: { joinCode } } })
      if (error) throw error
      return data!
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  })
}

// ---- Roster builder (F2) ----
export type RoundDto = components['schemas']['RoundDto']
export type RosterRules = components['schemas']['RosterRulesResponse']
export type PriceItem = components['schemas']['PriceItem']
export type RosterResponse = components['schemas']['RosterResponse']
export type RosterError = components['schemas']['RosterErrorResponse']
export type PutRosterRequest = components['schemas']['PutRosterRequest']
export type PlayerPicks = components['schemas']['PlayerPicksResponse']

export function useRounds(seasonId: number | undefined) {
  return useQuery({
    queryKey: ['rounds', seasonId],
    enabled: seasonId != null,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/rounds', { params: { query: { seasonId } } })
      assertOk(response, error)
      return data ?? []
    },
  })
}

export function useRound(roundId: number) {
  return useQuery({
    queryKey: ['round', roundId],
    queryFn: async () => {
      const { data, error } = await api.GET('/rounds/{id}', { params: { path: { id: roundId } } })
      if (error) throw error
      return data!
    },
  })
}

export function useRosterRules(roundId: number) {
  return useQuery({
    queryKey: ['roster-rules', roundId],
    enabled: roundId > 0,
    queryFn: async () => {
      const { data, error } = await api.GET('/rounds/{id}/roster-rules', { params: { path: { id: roundId } } })
      if (error) throw error
      return data!
    },
  })
}

export function usePrices(roundId: number) {
  return useQuery({
    queryKey: ['prices', roundId],
    enabled: roundId > 0,
    queryFn: async () => {
      const { data, error } = await api.GET('/rounds/{roundId}/prices', { params: { path: { roundId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRoster(registrationId: number | undefined, roundId: number) {
  return useQuery({
    queryKey: ['roster', registrationId, roundId],
    enabled: registrationId != null && roundId > 0,
    queryFn: async () => {
      const { data, error } = await api.GET('/registrations/{registrationId}/rounds/{roundId}/roster', {
        params: { path: { registrationId: registrationId!, roundId } },
      })
      if (error) throw error
      // 204 (no roster saved yet) → empty body. Return null, not undefined, or TanStack Query throws.
      return data ?? null
    },
  })
}

/**
 * Read-only view of ANOTHER player's picks + scores for a round (standings drill-in). Public to any
 * signed-in user, but the API only returns picks once the round is locked (else 409 not_locked).
 */
export function usePlayerPicks(registrationId: number | undefined, roundId: number | undefined) {
  return useQuery({
    queryKey: ['player-picks', registrationId, roundId],
    enabled: registrationId != null && roundId != null && roundId > 0,
    queryFn: async () => {
      const { data, error } = await api.GET('/registrations/{registrationId}/rounds/{roundId}/picks', {
        params: { path: { registrationId: registrationId!, roundId: roundId! } },
      })
      if (error) throw error
      return data!
    },
  })
}

/** PUT the roster. On 409/422 the thrown value is the typed RosterError (read it in onError). */
export function useSaveRoster(registrationId: number, roundId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: PutRosterRequest) => {
      const { data, error } = await api.PUT('/registrations/{registrationId}/rounds/{roundId}/roster', {
        params: { path: { registrationId, roundId } },
        body,
      })
      if (error) throw error as RosterError
      return data!
    },
    onSuccess: (data) => qc.setQueryData(['roster', registrationId, roundId], data),
  })
}
