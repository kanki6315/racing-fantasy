import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './schema'

/**
 * Admin console data layer (F4). Reads + CRUD for the catalog and entries, mirroring the typed
 * endpoints under the "Admin" policy. Same hand-written-hook style as queries.ts; query keys are
 * namespaced under 'admin' so a write can invalidate exactly the lists it touched.
 */

export type Championship = components['schemas']['ChampionshipDto']
export type Season = components['schemas']['SeasonDto']
export type ClassDto = components['schemas']['ClassDto']
export type RoundDto = components['schemas']['RoundDto']
export type EventDto = components['schemas']['EventDto']
export type SessionDto = components['schemas']['SessionDto']
export type CarEntryDto = components['schemas']['CarEntryDto']
export type DriverDto = components['schemas']['DriverDto']
export type EntryDriverDto = components['schemas']['EntryDriverDto']
export type RosterRuleDto = components['schemas']['RosterRuleDto']
export type RosterModifierRuleDto = components['schemas']['RosterModifierRuleDto']

const ak = {
  championships: ['admin', 'championships'] as const,
  seasons: (championshipId?: number) => ['admin', 'seasons', championshipId ?? 'all'] as const,
  classes: (championshipId?: number) => ['admin', 'classes', championshipId ?? 'all'] as const,
  rounds: (seasonId?: number) => ['admin', 'rounds', seasonId ?? 'all'] as const,
  sessions: (roundId?: number) => ['admin', 'sessions', roundId ?? 'all'] as const,
  carEntries: (seasonId?: number, classId?: number) =>
    ['admin', 'car-entries', seasonId ?? 'all', classId ?? 'all'] as const,
  drivers: (search?: string) => ['admin', 'drivers', search ?? ''] as const,
  entryDrivers: (seasonId?: number) => ['admin', 'entry-drivers', seasonId ?? 'all'] as const,
  rosterRules: (seasonId?: number) => ['admin', 'roster-rules', seasonId ?? 'all'] as const,
  modifierRules: (seasonId?: number) => ['admin', 'modifier-rules', seasonId ?? 'all'] as const,
}

function invalidate(qc: QueryClient, ...prefixes: string[][]) {
  for (const p of prefixes) qc.invalidateQueries({ queryKey: p })
}

// ---- Championships ----
export function useAdminChampionships() {
  return useQuery({
    queryKey: ak.championships,
    queryFn: async () => {
      const { data, error } = await api.GET('/championships')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateChampionship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateChampionship']) => {
      const { data, error } = await api.POST('/championships', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'championships']),
  })
}

export function useUpdateChampionship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: components['schemas']['UpdateChampionship'] }) => {
      const { data, error } = await api.PUT('/championships/{id}', { params: { path: { id } }, body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'championships']),
  })
}

// ---- Seasons ----
export function useAdminSeasons(championshipId?: number) {
  return useQuery({
    queryKey: ak.seasons(championshipId),
    queryFn: async () => {
      const { data, error } = await api.GET('/seasons', { params: { query: { championshipId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateSeason']) => {
      const { data, error } = await api.POST('/seasons', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'seasons']),
  })
}

// ---- Classes ----
export function useAdminClasses(championshipId?: number) {
  return useQuery({
    queryKey: ak.classes(championshipId),
    enabled: championshipId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/classes', { params: { query: { championshipId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateClass']) => {
      const { data, error } = await api.POST('/classes', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'classes']),
  })
}

export function useUpdateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: components['schemas']['UpdateClass'] }) => {
      const { data, error } = await api.PUT('/classes/{id}', { params: { path: { id } }, body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'classes']),
  })
}

export function useDeleteClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/classes/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'classes']),
  })
}

// ---- Rounds ----
export function useAdminRounds(seasonId?: number) {
  return useQuery({
    queryKey: ak.rounds(seasonId),
    enabled: seasonId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/rounds', { params: { query: { seasonId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateRound() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateRound']) => {
      const { data, error } = await api.POST('/rounds', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'rounds']),
  })
}

export function useUpdateRound() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: components['schemas']['UpdateRound'] }) => {
      const { data, error } = await api.PUT('/rounds/{id}', { params: { path: { id } }, body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'rounds']),
  })
}

// ---- Events (shared weekends, ADR-0007) ----
export function useAdminEvents() {
  return useQuery({
    queryKey: ['admin', 'events'] as const,
    queryFn: async () => {
      const { data, error } = await api.GET('/events')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateEvent']) => {
      const { data, error } = await api.POST('/events', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'events']),
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: components['schemas']['UpdateEvent'] }) => {
      const { data, error } = await api.PUT('/events/{id}', { params: { path: { id } }, body })
      if (error) throw error
      return data!
    },
    // A round may have changed event attachment elsewhere; refresh rounds too.
    onSuccess: () => invalidate(qc, ['admin', 'events'], ['admin', 'rounds']),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/events/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'events']),
  })
}

// ---- Sessions ----
export function useAdminSessions(roundId?: number) {
  return useQuery({
    queryKey: ak.sessions(roundId),
    enabled: roundId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/sessions', { params: { query: { roundId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateSession']) => {
      const { data, error } = await api.POST('/sessions', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'sessions']),
  })
}

export function useUpdateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: components['schemas']['UpdateSession'] }) => {
      const { data, error } = await api.PUT('/sessions/{id}', { params: { path: { id } }, body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'sessions']),
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/sessions/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'sessions']),
  })
}

// ---- Car entries ----
export function useCarEntries(seasonId?: number, classId?: number) {
  return useQuery({
    queryKey: ak.carEntries(seasonId, classId),
    enabled: seasonId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/car-entries', { params: { query: { seasonId, classId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateCarEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateCarEntry']) => {
      const { data, error } = await api.POST('/car-entries', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'car-entries']),
  })
}

export function useUpdateCarEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: components['schemas']['UpdateCarEntry'] }) => {
      const { data, error } = await api.PUT('/car-entries/{id}', { params: { path: { id } }, body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'car-entries']),
  })
}

export function useDeleteCarEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/car-entries/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'car-entries']),
  })
}

// ---- Drivers ----
export function useDrivers(search?: string) {
  return useQuery({
    queryKey: ak.drivers(search),
    queryFn: async () => {
      const { data, error } = await api.GET('/drivers', { params: { query: { search } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateDriver']) => {
      const { data, error } = await api.POST('/drivers', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'drivers']),
  })
}

export function useUpdateDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: components['schemas']['UpdateDriver'] }) => {
      const { data, error } = await api.PUT('/drivers/{id}', { params: { path: { id } }, body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'drivers']),
  })
}

export function useDeleteDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/drivers/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'drivers']),
  })
}

// ---- Lineups (entry-drivers) ----
export function useEntryDrivers(carEntryId?: number) {
  return useQuery({
    queryKey: ['admin', 'entry-drivers', carEntryId ?? 'all'] as const,
    queryFn: async () => {
      const { data, error } = await api.GET('/entry-drivers', { params: { query: { carEntryId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateEntryDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateEntryDriver']) => {
      const { data, error } = await api.POST('/entry-drivers', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'entry-drivers']),
  })
}

export function useDeleteEntryDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/entry-drivers/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'entry-drivers']),
  })
}

// ---- Registrations (admin directory) ----
export type RegistrationDto = components['schemas']['RegistrationDto']

export function useAdminRegistrations(seasonId?: number) {
  return useQuery({
    queryKey: ['admin', 'registrations', seasonId ?? 'all'] as const,
    enabled: seasonId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/registrations', { params: { query: { seasonId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

// ---- Users & data governance ----
export type UserDto = components['schemas']['UserDto']

export function useUsers() {
  return useQuery({
    queryKey: ['admin', 'users'] as const,
    queryFn: async () => {
      const { data, error } = await api.GET('/users')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/users/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'users']),
  })
}

/** Fetch the full GDPR access export (Art. 15) for a user — used to trigger a JSON download. */
export async function fetchUserExport(id: number): Promise<unknown> {
  const { data, error } = await api.GET('/users/{id}/export', { params: { path: { id } } })
  if (error) throw error
  return data
}

// ---- Results ingestion (stage preview → commit) ----
export type IngestResponse = components['schemas']['IngestResponse']
export type ResultKind = 'qualifying' | 'race'

/**
 * Upload a raw IMSA results CSV. commit=false stages a preview (matched/unmatched + computed
 * positions); commit=true publishes. The body is octet-stream, so we pass the CSV text straight
 * through with a custom bodySerializer rather than letting openapi-fetch JSON-encode it.
 */
export function useImportResults(roundId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ kind, csv, commit }: { kind: ResultKind; csv: string; commit: boolean }) => {
      const opts = {
        params: { path: { roundId }, query: { commit } },
        body: csv as unknown as never,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { 'Content-Type': 'application/octet-stream' },
      }
      const { data, error } =
        kind === 'qualifying'
          ? await api.POST('/rounds/{roundId}/qualifying-results/import', opts)
          : await api.POST('/rounds/{roundId}/race-results/import', opts)
      if (error) throw error
      return data as IngestResponse
    },
    onSuccess: (_d, vars) => {
      if (vars.commit) {
        qc.invalidateQueries({ queryKey: ['prices', roundId] })
        qc.invalidateQueries({ queryKey: ['scores', roundId] })
      }
    },
  })
}

// ---- Scoring ----
export type ScoresResponse = components['schemas']['ScoresResponse']
export type ScoreRoundResult = components['schemas']['ScoreRoundResult']

export function useScores(roundId: number) {
  return useQuery({
    queryKey: ['scores', roundId] as const,
    enabled: roundId > 0,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET('/rounds/{roundId}/scores', { params: { path: { roundId } } })
      if (error) throw error
      return data!
    },
  })
}

export function useScoreRound(roundId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/rounds/{roundId}/score', { params: { path: { roundId } } })
      if (error) throw error
      return data!
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scores', roundId] }),
  })
}

// ---- Prices (bulk upsert) ----
/** Bulk-upsert the whole round price board. The GET ['prices', roundId] cache is invalidated on success. */
export function useSavePrices(roundId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (prices: components['schemas']['PriceInput'][]) => {
      const { data, error } = await api.POST('/rounds/{roundId}/prices', {
        params: { path: { roundId } },
        body: { prices },
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prices', roundId] }),
  })
}

// ---- Roster rules (composition: season defaults + per-round overrides) ----
export function useAdminRosterRules(seasonId?: number) {
  return useQuery({
    queryKey: ak.rosterRules(seasonId),
    enabled: seasonId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/roster-rules', { params: { query: { seasonId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateRosterRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateRosterRule']) => {
      const { data, error } = await api.POST('/roster-rules', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'roster-rules']),
  })
}

export function useUpdateRosterRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: components['schemas']['UpdateRosterRule'] }) => {
      const { data, error } = await api.PUT('/roster-rules/{id}', { params: { path: { id } }, body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'roster-rules']),
  })
}

export function useDeleteRosterRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/roster-rules/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'roster-rules']),
  })
}

// ---- Roster modifier rules (bonus formats, season-scoped) ----
export function useAdminModifierRules(seasonId?: number) {
  return useQuery({
    queryKey: ak.modifierRules(seasonId),
    enabled: seasonId != null,
    queryFn: async () => {
      const { data, error } = await api.GET('/roster-modifier-rules', { params: { query: { seasonId } } })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateModifierRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateRosterModifierRule']) => {
      const { data, error } = await api.POST('/roster-modifier-rules', { body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'modifier-rules']),
  })
}

export function useUpdateModifierRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: components['schemas']['UpdateRosterModifierRule'] }) => {
      const { data, error } = await api.PUT('/roster-modifier-rules/{id}', { params: { path: { id } }, body })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'modifier-rules']),
  })
}

export function useDeleteModifierRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/roster-modifier-rules/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'modifier-rules']),
  })
}
