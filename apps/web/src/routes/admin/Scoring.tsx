import { useMemo } from 'react'
import { useAdmin } from '../../admin/AdminContext'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { PrimaryButton, EmptyState } from '../../admin/ui'
import {
  useScores,
  useScoreRound,
  useAdminRegistrations,
  type ScoresResponse,
} from '../../api/adminQueries'

type Row = { registrationId: number; team: string; quali: number; race: number; bonus: number; total: number }

function sumBy(reg: ScoresResponse['registrations'][number], source: string): number {
  const fromPicks = reg.picks.flatMap((p) => p.scores).filter((s) => s.source === source)
  const fromMods = reg.modifiers.flatMap((m) => m.scores).filter((s) => s.source === source)
  return [...fromPicks, ...fromMods].reduce((a, s) => a + s.points, 0)
}

export function Scoring() {
  const { roundId, round, seasonId } = useAdmin()
  const { data: scores, isLoading, error } = useScores(roundId ?? 0)
  const { data: regs = [] } = useAdminRegistrations(seasonId)
  const scoreRound = useScoreRound(roundId ?? 0)

  const teamById = useMemo(() => new Map(regs.map((r) => [r.id, r.teamName])), [regs])

  const rows: Row[] = useMemo(() => {
    if (!scores) return []
    return scores.registrations
      .map((reg) => ({
        registrationId: reg.registrationId,
        team: teamById.get(reg.registrationId) ?? `Reg #${reg.registrationId}`,
        quali: sumBy(reg, 'QualifyingPosition'),
        race: sumBy(reg, 'RacePosition'),
        bonus: sumBy(reg, 'Bonus') + sumBy(reg, 'RaceFastestLap'),
        total: reg.total,
      }))
      .sort((a, b) => b.total - a.total)
  }, [scores, teamById])

  if (!roundId || !round) return <EmptyState>Select a round in the topbar</EmptyState>

  const totals = {
    quali: rows.reduce((a, r) => a + r.quali, 0),
    race: rows.reduce((a, r) => a + r.race, 0),
    bonus: rows.reduce((a, r) => a + r.bonus, 0),
  }

  return (
    <>
      <AdminPageHeader
        title="Score Review"
        subtitle={`RD ${String(round.sequence).padStart(2, '0')} · ${round.circuit ?? round.name} — verify points before relying on standings.`}
        actions={
          <PrimaryButton onClick={() => scoreRound.mutate()} disabled={scoreRound.isPending}>
            {scoreRound.isPending ? 'Scoring…' : 'Score Round'}
          </PrimaryButton>
        }
      />

      {scoreRound.data && (
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[6px] border border-success/40 bg-success/[0.06] px-5 py-3">
          <span className="h-[7px] w-[7px] rounded-full bg-success" />
          <span className="font-display text-[13px] font-semibold uppercase tracking-[0.03em] text-ink">
            Scoring run complete
          </span>
          <span className="font-mono text-[11px] text-muted">
            {scoreRound.data.scoresInserted} inserted · {scoreRound.data.scoresUpdated} updated ·{' '}
            {scoreRound.data.totals.length} registrations
          </span>
          <span className="flex gap-2">
            {scoreRound.data.activeSources.map((s) => (
              <span
                key={s}
                className="rounded-[3px] border border-line-2 bg-surface-3 px-2 py-[2px] font-mono text-[10px] text-ink-2"
              >
                {s} ✓
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Source totals */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <SourceTile label="Qualifying" value={totals.quali} dot="bg-success" />
        <SourceTile label="Race" value={totals.race} dot="bg-brand-2" />
        <SourceTile label="Bonus" value={totals.bonus} dot="bg-warn" />
      </div>

      {isLoading ? (
        <EmptyState>Loading scores…</EmptyState>
      ) : error ? (
        <EmptyState>No scores for this round</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>No scores yet — run scoring once results are committed</EmptyState>
      ) : (
        <div className="rounded-[6px] border border-line bg-surface">
          <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem_6rem] gap-x-3 border-b border-line px-4 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
            <div>Rank</div>
            <div>Team</div>
            <div className="text-right">Quali</div>
            <div className="text-right">Race</div>
            <div className="text-right">Bonus</div>
            <div className="text-right">Total</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.registrationId}
              className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem_6rem] items-center gap-x-3 border-b border-line px-4 py-2 last:border-b-0"
            >
              <div className="font-mono text-[13px] text-muted">{i + 1}</div>
              <div className="truncate font-display text-[13px] font-semibold uppercase text-ink">{r.team}</div>
              <div className="text-right font-mono text-[12px] text-success">{r.quali || '—'}</div>
              <div className="text-right font-mono text-[12px] text-brand-2">{r.race || '—'}</div>
              <div className="text-right font-mono text-[12px] text-warn">{r.bonus || '—'}</div>
              <div className="text-right font-mono text-[13px] font-semibold text-ink">{r.total}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function SourceTile({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-[6px] border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-[6px] w-[6px] rounded-full ${dot}`} />
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{label}</span>
      </div>
      <div className="mt-1 font-mono text-[20px] text-ink">{value.toLocaleString()}</div>
    </div>
  )
}
