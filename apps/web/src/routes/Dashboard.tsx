import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, type Me } from '../auth/AuthContext'
import {
  useAllSeasons,
  useChampionships,
  useDiscoverLeagues,
  useJoinLeague,
  useLeagueLeaderboard,
  useMyLeagues,
  usePrices,
  useRoster,
  useRounds,
  type League,
} from '../api/queries'
import { useCountdown } from '../lib/useCountdown'
import { mockTrend } from '../lib/demoStats'
import { Demo } from '../components/Demo'
import { CreateLeagueModal, JoinByCodeModal } from '../components/LeagueModals'
import { EntityThumb } from '../components/EntityThumb'
import { DriverLineup } from '../components/DriverLineup'

type Registration = Me['registrations'][number]

/** The player home (F3): your-picks status per series + your leagues + discover. */
export function Dashboard() {
  const { user } = useAuth()
  const champs = useChampionships()
  const seasons = useAllSeasons()
  const myLeagues = useMyLeagues()
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  const seasonInfo = useMemo(() => {
    return (seasonId: number) => {
      const s = seasons.data?.find((x) => x.id === seasonId)
      const c = champs.data?.find((x) => x.id === s?.championshipId)
      return { champName: c?.name ?? 'Championship', year: s?.year }
    }
  }, [seasons.data, champs.data])

  if (!user) return null
  const regs = user.registrations
  const leagues = myLeagues.data ?? []
  const primarySeason = regs[0]?.seasonId

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* left rail — full-width below the content on mobile, fixed left rail at lg+ */}
      <aside className="order-last w-full flex-none border-t border-line bg-surface-3 p-[18px] pt-6 lg:order-first lg:w-[268px] lg:border-r lg:border-t-0">
        <div className="font-display text-[26px] font-extrabold italic uppercase text-ink">My Team</div>
        <div className="mb-5 font-sans text-[12px] text-muted">
          {regs.length} series · {leagues.length} leagues · {regs[0] ? seasonInfo(regs[0].seasonId).year : '—'}
        </div>

        <div className="mb-[11px] font-display text-[11px] tracking-[0.12em] uppercase text-muted-2">Your Picks</div>
        <div className="flex flex-col gap-1">
          {regs.map((r, i) => (
            <div key={r.id} className={`flex items-center justify-between rounded-[3px] px-[13px] py-[10px] ${i === 0 ? 'border border-brand bg-surface-2' : ''}`}>
              <span className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-ink">
                <span className="h-[15px] w-[4px] flex-none bg-brand [transform:skewX(-14deg)]" />
                {seasonInfo(r.seasonId).champName}
              </span>
            </div>
          ))}
          {regs.length === 0 && <div className="font-sans text-[12px] text-muted">No series yet.</div>}
        </div>

        <div className="my-5 h-px bg-line" />
        <div className="mb-[11px] font-display text-[11px] tracking-[0.12em] uppercase text-muted-2">Leagues</div>
        <div className="flex flex-col gap-1 font-display text-[13px] font-semibold uppercase tracking-[0.04em]">
          <Row label="All Leagues" value={leagues.length} strong />
          <Row label="Public" value={leagues.filter((l) => l.visibility === 'Public').length} />
          <Row label="Private" value={leagues.filter((l) => l.visibility === 'Private').length} />
        </div>

        <button onClick={() => setCreateOpen(true)} className="mt-6 flex h-[46px] w-full items-center justify-center gap-2 rounded-[3px] bg-brand font-display text-[16px] font-bold italic uppercase tracking-[0.05em] text-ink cursor-pointer">
          + Create League
        </button>
        <button onClick={() => setJoinOpen(true)} className="mt-[10px] flex h-[42px] w-full items-center justify-center rounded-[3px] border border-line-2 font-display text-[15px] font-semibold uppercase tracking-[0.05em] text-ink-2 cursor-pointer">
          Join with Code
        </button>
      </aside>

      {/* main */}
      <div className="min-w-0 flex-1 bg-bg">
        <div className="flex flex-wrap items-center gap-x-[11px] gap-y-1 px-4 pb-1 pt-[22px] sm:px-[26px]">
          <span className="font-display text-[22px] font-extrabold italic uppercase text-ink">Your Picks</span>
          <span className="hidden rounded-full border border-lmp2/35 bg-lmp2/10 px-[10px] py-[3px] font-sans text-[11px] text-lmp2-2 sm:inline-block">
            One lineup per series — scored across all your leagues
          </span>
        </div>

        <div className="flex flex-col gap-3 px-4 py-[10px] sm:px-[26px]">
          {regs.map((r) => (
            <RegistrationCard key={r.id} reg={r} champName={seasonInfo(r.seasonId).champName} />
          ))}
        </div>

        <div className="mx-4 mt-[22px] h-px bg-line sm:mx-[26px]" />

        {/* your leagues */}
        <div className="flex flex-wrap items-center gap-x-[11px] gap-y-1 px-4 pb-[14px] pt-5 sm:px-[26px]">
          <span className="font-display text-[22px] font-extrabold italic uppercase text-ink">Your Leagues</span>
          <span className="hidden font-sans text-[12px] text-muted sm:inline">Your picks are scored into every league below</span>
        </div>
        {leagues.length === 0 ? (
          <div className="mx-4 rounded-[4px] border border-dashed border-line-2 px-5 py-8 text-center font-sans text-[13px] text-muted sm:mx-[26px]">
            You haven't joined any leagues yet — create one or join with a code.
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_110px_100px_110px] items-center border-y border-line px-[26px] py-[10px] font-display text-[11px] tracking-[0.1em] uppercase text-muted-2 sm:grid">
              <span>League</span><span className="text-center">Position</span><span className="text-center">Trend</span><span />
            </div>
            {leagues.map((l) => (
              <LeagueRow key={l.id} league={l} me={user} />
            ))}
          </>
        )}

        <DiscoverLeagues seasonId={primarySeason} />
      </div>

      {primarySeason != null && <CreateLeagueModal seasonId={primarySeason} open={createOpen} onOpenChange={setCreateOpen} />}
      <JoinByCodeModal open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[3px] px-[13px] py-[10px]">
      <span className={strong ? 'text-ink' : 'text-ink-2'}>{label}</span>
      <span className="font-mono text-[12px] text-muted">{value}</span>
    </div>
  )
}

// ---- Your-picks card (resolves round + roster + names) ----
function RegistrationCard({ reg, champName }: { reg: Registration; champName: string }) {
  const rounds = useRounds(reg.seasonId)
  const round = rounds.data?.[0]
  const roster = useRoster(reg.id, round?.id ?? 0)
  const prices = usePrices(round?.id ?? 0)
  const cd = useCountdown(round?.qualiStart)

  const locked = cd.locked || roster.data?.locked === true
  const picks = roster.data ? roster.data.main.length : 0
  const status = locked ? { t: 'LOCKED', c: 'text-muted' } : picks > 0 ? { t: 'SET', c: 'text-success' } : { t: 'TO DO', c: 'text-warn' }

  const itemOf = (p: { entityType: string; entityId: number }) =>
    prices.data?.find((x) => x.entityType === p.entityType && x.entityId === p.entityId)

  // Bonus modifiers targeting each pick, keyed by entity (ADR-0006). Shown as a small gold badge.
  const bonusLabel: Record<string, string> = { DOUBLE_POINTS_TEAM: '2×', CAPTAIN: 'C' }
  const bonusByPick = new Map<string, string>()
  for (const m of roster.data?.modifiers ?? [])
    if (m.target) bonusByPick.set(`${m.target.entityType}:${m.target.entityId}`, bonusLabel[m.kind] ?? '★')

  return (
    <div className="flex flex-col items-stretch overflow-hidden rounded-[4px] border border-line border-l-[3px] border-l-brand bg-surface sm:flex-row">
      <div className="flex-none border-b border-line p-[15px] sm:w-[188px] sm:border-b-0 sm:border-r">
        <div className="flex items-start gap-2">
          <span className="mt-1 h-[18px] w-[5px] flex-none bg-brand [transform:skewX(-14deg)]" />
          <span className="font-display text-[17px] font-bold uppercase leading-tight text-ink">{champName}</span>
        </div>
        <div className="mt-[7px] font-sans text-[12px] text-muted">{round ? round.name : '—'}</div>
        <div className={`mt-[9px] font-mono text-[11px] font-semibold ${status.c}`}>
          {locked ? 'LOCKED' : picks > 0 ? `LOCKS ${cd.text}` : 'NOT SET'}
        </div>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-2 p-[15px]">
        {picks > 0 ? (
          (roster.data?.main ?? []).map((p) => {
            const pi = itemOf(p)
            const badge = bonusByPick.get(`${p.entityType}:${p.entityId}`)
            return (
              <div key={`${p.entityType}:${p.entityId}`} className="flex items-center gap-2 rounded-[3px] border border-line-2 bg-surface-2 p-1.5 pr-2.5">
                <EntityThumb
                  entityType={p.entityType as 'Car' | 'Driver'}
                  entityId={p.entityId}
                  roundId={round?.id ?? 0}
                  shape={p.entityType === 'Car' ? 'wide' : 'square'}
                  className="w-11"
                />
                <div className="min-w-0 max-w-[150px]">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-sans text-[12px] font-medium text-ink-2">{pi?.displayName ?? '—'}</span>
                    {badge && (
                      <span
                        className="flex h-[16px] flex-none items-center rounded-[2px] px-[5px] font-mono text-[10px] font-bold text-[#1a1206]"
                        style={{ background: '#ffc23d' }}
                        title="Bonus applied"
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <DriverLineup drivers={pi?.drivers} variant="compact" className="mt-0.5" />
                </div>
              </div>
            )
          })
        ) : (
          <span className="font-sans text-[13px] text-muted">No picks yet for {round?.name ?? 'this round'}.</span>
        )}
      </div>

      <div className="flex flex-none items-center border-t border-line p-[15px] sm:border-t-0">
        {round && (
          <Link
            to={`/pick/${round.id}`}
            className={`flex h-[38px] w-full items-center justify-center rounded-[3px] px-[18px] font-display text-[14px] font-semibold uppercase tracking-[0.04em] sm:w-auto ${
              status.t === 'TO DO' ? 'bg-brand font-bold italic text-ink' : 'border border-line-2 text-ink-2'
            }`}
          >
            {locked ? 'View Lineup' : picks > 0 ? 'Edit Picks' : 'Make Picks →'}
          </Link>
        )}
      </div>
    </div>
  )
}

// ---- Your-leagues row (position from the league leaderboard) ----
function LeagueRow({ league, me }: { league: League; me: Me }) {
  const lb = useLeagueLeaderboard(league.id)
  const myReg = me.registrations.find((r) => r.seasonId === league.seasonId)
  const myRow = lb.data?.entries.find((e) => e.registrationId === myReg?.id)
  const rank = myRow?.rank
  const trend = mockTrend(league.id)
  const initials = league.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      {/* sm+ : grid row */}
      <div className="hidden grid-cols-[1fr_110px_100px_110px] items-center border-b border-surface-2 px-[26px] py-[15px] sm:grid">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[5px] border border-line-3 bg-surface-2 font-display text-[15px] font-extrabold italic text-ink">{initials}</div>
          <div className="min-w-0">
            <div className="truncate font-display text-[17px] font-bold uppercase leading-none text-ink">{league.name}</div>
            <div className="mt-[3px] font-sans text-[11px] text-muted">{league.visibility} · {league.memberCount} players</div>
          </div>
        </div>
        <span className="text-center font-mono text-[16px] font-bold text-ink">
          {rank ?? '—'}<span className="text-[11px] text-muted-2">/{league.memberCount}</span>
        </span>
        <Demo>
          <span className={`block text-center font-mono text-[13px] ${trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-muted-2'}`}>
            {trend > 0 ? `▲ ${trend}` : trend < 0 ? `▼ ${-trend}` : '— 0'}
          </span>
        </Demo>
        <span className="text-right">
          <Link to={`/leagues/${league.id}`} className="rounded-[3px] border border-line-2 px-[14px] py-[7px] font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2">
            Standings
          </Link>
        </span>
      </div>

      {/* < sm : card (Trend dropped — it's mocked anyway) */}
      <div className="flex items-center gap-3 border-b border-surface-2 px-4 py-[14px] sm:hidden">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[5px] border border-line-3 bg-surface-2 font-display text-[14px] font-extrabold italic text-ink">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[16px] font-bold uppercase leading-none text-ink">{league.name}</div>
          <div className="mt-[3px] font-sans text-[11px] text-muted">{league.visibility} · {league.memberCount} players</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[15px] font-bold text-ink">
            {rank ?? '—'}<span className="text-[10px] text-muted-2">/{league.memberCount}</span>
          </span>
          <Link to={`/leagues/${league.id}`} className="rounded-[3px] border border-line-2 px-[10px] py-[4px] font-display text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2">
            Standings
          </Link>
        </div>
      </div>
    </>
  )
}

// ---- Discover public leagues ----
function DiscoverLeagues({ seasonId }: { seasonId: number | undefined }) {
  const discover = useDiscoverLeagues(seasonId)
  const join = useJoinLeague()
  // The list endpoint reports real membership, so hide leagues we're already in.
  const leagues = (discover.data ?? []).filter((l) => !l.isMember)
  if (leagues.length === 0) return null

  return (
    <div className="px-4 py-6 sm:px-[26px]">
      <div className="mb-[14px] font-display text-[18px] font-extrabold italic uppercase text-ink">Discover Public Leagues</div>
      <div className="flex flex-wrap gap-3">
        {leagues.map((l) => (
          <div
            key={l.id}
            className="flex min-w-0 flex-1 basis-full items-center justify-between gap-4 rounded-[3px] border border-line bg-surface px-[15px] py-[13px] sm:basis-[260px]"
          >
            <div className="min-w-0">
              <div className="truncate font-display text-[15px] font-bold uppercase text-ink">{l.name}</div>
              <div className="font-sans text-[11px] text-muted">{l.memberCount} players · Public</div>
            </div>
            <button
              onClick={() => join.mutate({ id: l.id })}
              disabled={join.isPending}
              className="flex-none rounded-[3px] border border-line-2 px-3 py-[6px] font-display text-[12px] font-semibold uppercase text-ink cursor-pointer"
            >
              Join
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
