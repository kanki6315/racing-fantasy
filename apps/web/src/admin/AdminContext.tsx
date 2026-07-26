import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { pickCurrentRound } from '../lib/adminBoard'
import {
  useAdminChampionships,
  useAdminSeasons,
  useAdminRounds,
  type Championship,
  type Season,
  type RoundDto,
} from '../api/adminQueries'

/**
 * The championship → season → round the admin console is "pointed at". The topbar selectors set
 * it; Catalog/Entries/Prices/etc. read it. Persisted to localStorage so a refresh keeps your place.
 * Selection self-heals: if a stored id isn't in the freshly loaded list, it falls back to a sensible
 * default (first championship, newest season, the round whose qualifying is next).
 */
type AdminCtx = {
  championshipId?: number
  seasonId?: number
  roundId?: number
  setChampionshipId: (id: number) => void
  setSeasonId: (id: number) => void
  setRoundId: (id: number) => void
  championship?: Championship
  season?: Season
  round?: RoundDto
  championships: Championship[]
  seasons: Season[]
  rounds: RoundDto[]
  /**
   * True until the championship → season → round chain has resolved. `round` is undefined either
   * way, so a screen that can't tell these apart renders "select a round from the topbar" while it
   * is still loading — an instruction where a loading state belongs.
   */
  isResolving: boolean
  /** The context chain failed to load. Distinct from "this season has no rounds yet". */
  contextError: boolean
  /** Refetch the whole chain — the retry behind an error state. */
  retryContext: () => void
}

const Ctx = createContext<AdminCtx | null>(null)
const LS_KEY = 'endurance.admin.selection'

function loadStored(): { championshipId?: number; seasonId?: number; roundId?: number } {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}


export function AdminProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(loadStored, [])
  const [championshipId, setChampId] = useState<number | undefined>(stored.championshipId)
  const [seasonId, setSeasonIdState] = useState<number | undefined>(stored.seasonId)
  const [roundId, setRoundIdState] = useState<number | undefined>(stored.roundId)

  const champQ = useAdminChampionships()
  const seasonQ = useAdminSeasons(championshipId)
  const roundQ = useAdminRounds(seasonId)
  const { data: championships = [] } = champQ
  const { data: seasons = [] } = seasonQ
  const { data: rounds = [] } = roundQ

  // Self-heal championship: keep a valid id, else default to the first.
  useEffect(() => {
    if (championships.length === 0) return
    if (!championshipId || !championships.some((c) => c.id === championshipId)) {
      setChampId(championships[0].id)
      setSeasonIdState(undefined)
      setRoundIdState(undefined)
    }
  }, [championships, championshipId])

  // Self-heal season: newest year for the current championship.
  useEffect(() => {
    if (seasons.length === 0) return
    if (!seasonId || !seasons.some((s) => s.id === seasonId)) {
      const newest = [...seasons].sort((a, b) => b.year - a.year)[0]
      setSeasonIdState(newest.id)
      setRoundIdState(undefined)
    }
  }, [seasons, seasonId])

  // Self-heal round: the next-to-qualify round.
  useEffect(() => {
    if (rounds.length === 0) return
    if (!roundId || !rounds.some((r) => r.id === roundId)) {
      setRoundIdState(pickCurrentRound(rounds, Date.now())?.id)
    }
  }, [rounds, roundId])

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ championshipId, seasonId, roundId }))
  }, [championshipId, seasonId, roundId])

  // The chain resolves in stages — each list arrives, then a heal effect picks an id from it on the
  // next tick — so "still working" means any link is fetching *or* its id hasn't been chosen yet.
  // Each `length > 0` guard stops a genuinely-empty link (fresh database, season with no rounds)
  // from leaving the console spinning forever on a stage that will never advance.
  const contextError = champQ.isError || seasonQ.isError || roundQ.isError
  const isResolving =
    !contextError &&
    (champQ.isPending ||
      (championships.length > 0 &&
        (seasonQ.isPending ||
          (seasons.length > 0 && (seasonId == null || roundQ.isPending || (rounds.length > 0 && roundId == null))))))

  const value: AdminCtx = {
    championshipId,
    seasonId,
    roundId,
    isResolving,
    contextError,
    retryContext: () => {
      void champQ.refetch()
      void seasonQ.refetch()
      void roundQ.refetch()
    },
    setChampionshipId: (id) => {
      setChampId(id)
      setSeasonIdState(undefined)
      setRoundIdState(undefined)
    },
    setSeasonId: (id) => {
      setSeasonIdState(id)
      setRoundIdState(undefined)
    },
    setRoundId: setRoundIdState,
    championship: championships.find((c) => c.id === championshipId),
    season: seasons.find((s) => s.id === seasonId),
    round: rounds.find((r) => r.id === roundId),
    championships,
    seasons,
    rounds,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
