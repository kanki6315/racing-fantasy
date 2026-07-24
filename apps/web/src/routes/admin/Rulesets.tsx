import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from '../../admin/AdminContext'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { Panel, Tabs, TextInput, PrimaryButton, GhostButton, EmptyState } from '../../admin/ui'
import {
  useScoringRulesets,
  useRulesetDetail,
  useCreateRuleset,
  type RulesetDto,
  type ScoringSource,
} from '../../api/adminQueries'

/**
 * Scoring-ruleset authoring (ADR-0003). MAIN scores from two sources — qualifying position and race
 * position — each backed by a versioned rank → points table, scoped to the season. Without an active
 * ruleset per source the scoring engine is a no-op, so this screen is the prerequisite for any
 * standings. Saving publishes a new version and activates it (archiving the prior active one); there
 * is no in-place edit by design (every change is an auditable version bump).
 */

const SOURCES: { id: ScoringSource; label: string; dot: string }[] = [
  { id: 'QualifyingPosition', label: 'Qualifying Position', dot: 'bg-success' },
  { id: 'RacePosition', label: 'Race Position', dot: 'bg-brand-2' },
]

/** F1-style starting table (ADR-0003 example) used to seed a brand-new source. */
const F1_DEFAULT = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

type Row = { rank: number; points: string }

function statusChip(status: RulesetDto['status']) {
  const map: Record<RulesetDto['status'], string> = {
    Active: 'border-success/40 bg-success/[0.08] text-success',
    Draft: 'border-warn/40 bg-warn/[0.08] text-warn',
    Archived: 'border-line-2 bg-surface-3 text-muted-2',
  }
  return (
    <span className={`rounded-[3px] border px-2 py-[2px] font-mono text-[9px] uppercase tracking-[0.08em] ${map[status]}`}>
      {status}
    </span>
  )
}

export function Rulesets() {
  const { seasonId, season, championship } = useAdmin()
  const [source, setSource] = useState<ScoringSource>('QualifyingPosition')

  const { data: rulesets = [], isLoading } = useScoringRulesets(seasonId)
  const forSource = useMemo(
    () => rulesets.filter((r) => r.source === source).sort((a, b) => b.version - a.version),
    [rulesets, source],
  )
  const active = forSource.find((r) => r.status === 'Active')
  const { data: activeDetail } = useRulesetDetail(active?.id)
  const create = useCreateRuleset(seasonId ?? 0)

  // Editable draft, seeded from the active version's table (or the F1 default for an unconfigured source).
  const [rows, setRows] = useState<Row[]>([])
  const [loadedKey, setLoadedKey] = useState<string>('')
  const key = `${source}:${active?.id ?? 'none'}:${activeDetail?.id ?? 'none'}`

  useEffect(() => {
    if (key === loadedKey) return
    // Wait for the active version's detail before seeding, so we don't clobber it with the default.
    if (active && !activeDetail) return
    const seed: Row[] =
      activeDetail?.positionPoints.map((p) => ({ rank: p.rank, points: String(p.points) })) ??
      F1_DEFAULT.map((pts, i) => ({ rank: i + 1, points: String(pts) }))
    setRows(seed)
    setLoadedKey(key)
  }, [key, loadedKey, active, activeDetail])

  const dirty = useMemo(() => {
    const current =
      activeDetail?.positionPoints.map((p) => `${p.rank}=${p.points}`).join(',') ??
      F1_DEFAULT.map((pts, i) => `${i + 1}=${pts}`).join(',')
    const draft = rows.map((r) => `${r.rank}=${Number(r.points)}`).join(',')
    return current !== draft
  }, [rows, activeDetail])

  const invalid = rows.length === 0 || rows.some((r) => r.points.trim() === '' || Number.isNaN(Number(r.points)))

  function setPoints(rank: number, points: string) {
    setRows((rs) => rs.map((r) => (r.rank === rank ? { ...r, points } : r)))
  }
  function addRow() {
    setRows((rs) => [...rs, { rank: rs.length + 1, points: '0' }])
  }
  function removeLast() {
    setRows((rs) => rs.slice(0, -1))
  }
  function loadF1() {
    setRows(F1_DEFAULT.map((pts, i) => ({ rank: i + 1, points: String(pts) })))
  }

  function save() {
    create.mutate(
      {
        source,
        activate: true,
        positionPoints: rows.map((r) => ({ rank: r.rank, points: Number(r.points) })),
      },
      { onSuccess: () => setLoadedKey('') }, // force re-seed from the freshly-saved active version
    )
  }

  if (!seasonId || !season) return <EmptyState>Select a season in the topbar</EmptyState>

  return (
    <>
      <AdminPageHeader
        title="Scoring Rulesets"
        subtitle={
          <>
            {championship?.name} · {season.year} — the rank → points table each MAIN source scores from.
            An <span className="text-success">Active</span> ruleset per source is required before a round
            will score.
          </>
        }
      />

      <Tabs tabs={SOURCES.map((s) => ({ id: s.id, label: s.label }))} active={source} onChange={(id) => setSource(id as ScoringSource)} />

      {!active && (
        <div className="mb-5 flex items-center gap-3 rounded-[6px] border border-warn/40 bg-warn/[0.06] px-5 py-3">
          <span className="h-[7px] w-[7px] rounded-full bg-warn" />
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-warn">
            No active ruleset for this source — this source scores 0 until you publish one.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        {/* Editor */}
        <Panel
          title={`Rank → Points · ${SOURCES.find((s) => s.id === source)!.label}`}
          actions={
            <div className="flex items-center gap-2">
              {active ? (
                <span className="font-mono text-[10px] text-muted-2">editing from v{active.version}</span>
              ) : (
                <span className="font-mono text-[10px] text-warn">new — v1</span>
              )}
              <GhostButton onClick={loadF1} className="h-7 px-2 text-[11px]">
                Load F1 preset
              </GhostButton>
            </div>
          }
        >
          {isLoading ? (
            <EmptyState>Loading rulesets…</EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-3 border-b border-line pb-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
                <div>Finishing Rank</div>
                <div className="text-right">Points</div>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {rows.map((r) => (
                  <div key={r.rank} className="grid grid-cols-2 items-center gap-x-3 border-b border-line py-[6px] last:border-b-0">
                    <div className="font-mono text-[13px] text-ink-2">
                      P{r.rank}
                      {r.rank === 1 && <span className="ml-2 text-[10px] text-muted-2">class pole / win</span>}
                    </div>
                    <div className="flex justify-end">
                      <TextInput
                        type="number"
                        step="any"
                        value={r.points}
                        onChange={(e) => setPoints(r.rank, e.target.value)}
                        className="h-8 w-24 text-right font-mono"
                        aria-label={`Points for position ${r.rank}`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <GhostButton onClick={addRow} className="h-8 px-3 text-[11px]">
                    + Position
                  </GhostButton>
                  <GhostButton onClick={removeLast} disabled={rows.length <= 1} className="h-8 px-3 text-[11px]">
                    − Remove last
                  </GhostButton>
                </div>
                <div className="flex items-center gap-3">
                  {dirty && <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-warn">unsaved changes</span>}
                  <PrimaryButton onClick={save} disabled={!dirty || invalid || create.isPending}>
                    {create.isPending ? 'Publishing…' : active ? `Publish v${active.version + 1}` : 'Publish v1'}
                  </PrimaryButton>
                </div>
              </div>

              {create.isError && (
                <div className="mt-3 rounded-[4px] border border-danger/40 bg-danger/[0.06] px-3 py-2 font-mono text-[11px] text-danger">
                  {(create.error as Error)?.message ?? 'Failed to publish ruleset'}
                </div>
              )}
              {create.isSuccess && !dirty && (
                <div className="mt-3 rounded-[4px] border border-success/40 bg-success/[0.06] px-3 py-2 font-mono text-[11px] text-success">
                  Published — re-run scoring on affected rounds to apply.
                </div>
              )}
            </>
          )}
        </Panel>

        {/* Version history */}
        <Panel title="Version History">
          {forSource.length === 0 ? (
            <EmptyState>No versions yet</EmptyState>
          ) : (
            <div className="flex flex-col">
              {forSource.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-line py-2 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-ink-2">v{r.version}</span>
                    {statusChip(r.status)}
                  </div>
                  <span className="font-mono text-[10px] text-muted-2">
                    {new Date(r.effectiveFrom).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
