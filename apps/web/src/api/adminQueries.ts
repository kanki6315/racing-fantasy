import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, unwrap } from './client'
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
      return unwrap(await api.GET('/classes', { params: { query: { championshipId } } })) ?? []
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
    // ['events'] is the player-facing cache (Dashboard/Landing); refresh it too, not just admin's.
    onSuccess: () => invalidate(qc, ['admin', 'events'], ['events']),
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
    // A round may have changed event attachment elsewhere; refresh rounds too. ['events'] is the
    // player-facing cache — a scored/finalized/picks-open change must reflect on the Dashboard/Landing.
    onSuccess: () => invalidate(qc, ['admin', 'events'], ['admin', 'rounds'], ['events']),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/events/{id}', { params: { path: { id } } })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, ['admin', 'events'], ['events']),
  })
}

// ---- Sessions ----
export function useAdminSessions(roundId?: number) {
  return useQuery({
    queryKey: ak.sessions(roundId),
    enabled: roundId != null,
    queryFn: async () => {
      return unwrap(await api.GET('/sessions', { params: { query: { roundId } } })) ?? []
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
      return unwrap(await api.GET('/car-entries', { params: { query: { seasonId, classId } } })) ?? []
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

/**
 * The endpoint filters by car or driver only, so the unfiltered call returns every lineup row in
 * the database. That's fine for the Prices board, which needs them all — but `enabled` lets a
 * screen that only *might* need them (the Overview, for a driver-priced series) hold the request
 * until it knows. Same cache key either way, so whoever asks first warms it for the other.
 */
export function useEntryDrivers(carEntryId?: number, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'entry-drivers', carEntryId ?? 'all'] as const,
    enabled: opts?.enabled ?? true,
    queryFn: async () => {
      return unwrap(await api.GET('/entry-drivers', { params: { query: { carEntryId } } })) ?? []
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
 * raceNumber targets a specific race of a multi-race weekend (race imports only; default 1).
 */
export function useImportResults(roundId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      kind,
      csv,
      commit,
      raceNumber,
    }: {
      kind: ResultKind
      csv: string
      commit: boolean
      raceNumber?: number
    }) => {
      const body = {
        body: csv as unknown as never,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { 'Content-Type': 'application/octet-stream' },
      }
      const { data, error } =
        kind === 'qualifying'
          ? await api.POST('/rounds/{roundId}/qualifying-results/import', {
              ...body,
              params: { path: { roundId }, query: { commit } },
            })
          : await api.POST('/rounds/{roundId}/race-results/import', {
              ...body,
              params: { path: { roundId }, query: { commit, raceNumber: raceNumber ?? 1 } },
            })
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

// ---- Entry-list JSON import (parser output, one file per series per event) ----
export type ParserEntryList = components['schemas']['ParserEntryList']
export type EntryListImportResult = components['schemas']['EntryListImportResult']

/**
 * Import a parser-produced entry-list JSON into a round. dryRun=true returns the same result shape
 * as a preview without writing; the commit re-sends the file with dryRun=false. Classes the
 * championship doesn't have yet are created (name = class_code, order = class_order).
 */
export function useImportEntryList(roundId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, dryRun }: { file: ParserEntryList; dryRun: boolean }) => {
      const { data, error } = await api.POST('/rounds/{roundId}/entry-list/import', {
        params: { path: { roundId }, query: { dryRun, createMissingClasses: true } },
        body: file,
      })
      if (error) throw error
      return data!
    },
    onSuccess: (_d, vars) => {
      if (!vars.dryRun) {
        invalidate(
          qc,
          ['admin', 'car-entries'],
          ['admin', 'drivers'],
          ['admin', 'entry-drivers'],
          ['admin', 'classes'],
        )
        qc.invalidateQueries({ queryKey: ['prices', roundId] })
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
      return unwrap(await api.GET('/rounds/{roundId}/scores', { params: { path: { roundId } } }))!
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

// ---- Scoring rulesets (versioned rank → points tables per source, season-scoped) ----
export type RulesetDto = components['schemas']['RulesetDto']
export type RulesetDetailDto = components['schemas']['RulesetDetailDto']
export type ScoringSource = components['schemas']['ScoringSource']

export function useScoringRulesets(seasonId?: number) {
  return useQuery({
    queryKey: ['admin', 'scoring-rulesets', seasonId ?? 'all'] as const,
    enabled: seasonId != null,
    queryFn: async () => {
      return (
        unwrap(
          await api.GET('/seasons/{seasonId}/scoring-rulesets', { params: { path: { seasonId: seasonId! } } }),
        ) ?? []
      )
    },
  })
}

/** Full rank→points table for one ruleset; used to load an existing version into the editor. */
export function useRulesetDetail(id?: number) {
  return useQuery({
    queryKey: ['admin', 'scoring-ruleset', id ?? 0] as const,
    enabled: id != null && id > 0,
    queryFn: async () => {
      const { data, error } = await api.GET('/scoring-rulesets/{id}', { params: { path: { id: id! } } })
      if (error) throw error
      return data!
    },
  })
}

/** Publish a new ruleset version for a (season, source); activating archives the prior active one. */
export function useCreateRuleset(seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateRuleset']) => {
      const { data, error } = await api.POST('/seasons/{seasonId}/scoring-rulesets', {
        params: { path: { seasonId } },
        body,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => invalidate(qc, ['admin', 'scoring-rulesets']),
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

// ---- API liveness ----

/**
 * Polls `GET /health` so the console's status dot reports something it actually checked — it used
 * to be a hardcoded green dot reading "all systems go", which is the worst thing an ops console can
 * put on screen. It is a liveness probe and nothing more (the API answered), so its label must not
 * overclaim. One retry, because a dropped request on a laptop waking from sleep is not an outage.
 */
export function useApiHealth() {
  return useQuery({
    queryKey: ['admin', 'health'] as const,
    queryFn: async () => {
      unwrap(await api.GET('/health'))
      return true
    },
    retry: 1,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

// ---- Cross-championship board ----

/**
 * Unfiltered reads, for the one screen that has to answer a question about *every* championship at
 * once rather than the selected one.
 *
 * These exist as separate hooks rather than as relaxed `enabled` guards on the filtered versions,
 * and the distinction matters more than it looks. `useAdminRounds(seasonId)` is disabled until a
 * season resolves — but a disabled query still *reads its cache key*. Had these written to
 * `['admin','rounds','all']`, `AdminContext` would have picked up every round in the database
 * during the window before its season healed and handed them to the topbar as one season's rounds.
 * The `board` segment keeps the two sets of data in separate cache entries that can never be
 * mistaken for each other.
 *
 * Five requests cover the whole console. The list endpoints all return unfiltered when given no
 * filter, so the board costs a handful of calls rather than one set per championship — which is why
 * this needed no new API surface.
 */
const boardKey = (kind: string) => ['admin', 'board', kind] as const

export function useAllSeasons() {
  return useQuery({
    queryKey: boardKey('seasons'),
    queryFn: async () => unwrap(await api.GET('/seasons', { params: { query: {} } })) ?? [],
  })
}

export function useAllRounds() {
  return useQuery({
    queryKey: boardKey('rounds'),
    queryFn: async () => unwrap(await api.GET('/rounds', { params: { query: {} } })) ?? [],
  })
}

export function useAllClasses() {
  return useQuery({
    queryKey: boardKey('classes'),
    queryFn: async () => unwrap(await api.GET('/classes', { params: { query: {} } })) ?? [],
  })
}

export function useAllCarEntries() {
  return useQuery({
    queryKey: boardKey('car-entries'),
    queryFn: async () => unwrap(await api.GET('/car-entries', { params: { query: {} } })) ?? [],
  })
}

export function useAllSessions() {
  return useQuery({
    queryKey: boardKey('sessions'),
    queryFn: async () => unwrap(await api.GET('/sessions', { params: { query: {} } })) ?? [],
  })
}
