import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
}

const Ctx = createContext<AdminCtx | null>(null)
const LS_KEY = 'imsa.admin.selection'

function loadStored(): { championshipId?: number; seasonId?: number; roundId?: number } {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** The round whose qualifying is soonest in the future, else the last round (latest season state). */
function defaultRound(rounds: RoundDto[]): RoundDto | undefined {
  if (rounds.length === 0) return undefined
  const now = Date.now()
  const upcoming = rounds
    .filter((r) => Date.parse(r.qualiStart) >= now)
    .sort((a, b) => Date.parse(a.qualiStart) - Date.parse(b.qualiStart))
  return upcoming[0] ?? [...rounds].sort((a, b) => b.sequence - a.sequence)[0]
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(loadStored, [])
  const [championshipId, setChampId] = useState<number | undefined>(stored.championshipId)
  const [seasonId, setSeasonIdState] = useState<number | undefined>(stored.seasonId)
  const [roundId, setRoundIdState] = useState<number | undefined>(stored.roundId)

  const { data: championships = [] } = useAdminChampionships()
  const { data: seasons = [] } = useAdminSeasons(championshipId)
  const { data: rounds = [] } = useAdminRounds(seasonId)

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
      setRoundIdState(defaultRound(rounds)?.id)
    }
  }, [rounds, roundId])

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ championshipId, seasonId, roundId }))
  }, [championshipId, seasonId, roundId])

  const value: AdminCtx = {
    championshipId,
    seasonId,
    roundId,
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
