import { useRef, useState } from 'react'
import { useAdmin } from '../../admin/AdminContext'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { PrimaryButton, GhostButton, ClassSwatch, EmptyState } from '../../admin/ui'
import { useImportResults, type ResultKind, type IngestResponse } from '../../api/adminQueries'
import { classMeta } from '../../lib/classMeta'

export function Results() {
  const { roundId, round } = useAdmin()
  const [kind, setKind] = useState<ResultKind>('race')
  const [fileName, setFileName] = useState<string | null>(null)
  const [csv, setCsv] = useState<string | null>(null)
  const [preview, setPreview] = useState<IngestResponse | null>(null)
  const [committed, setCommitted] = useState<IngestResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importer = useImportResults(roundId ?? 0)

  const reset = () => {
    setFileName(null)
    setCsv(null)
    setPreview(null)
    setCommitted(null)
    setErr(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onPick = async (file: File) => {
    setErr(null)
    setPreview(null)
    setCommitted(null)
    setFileName(file.name)
    setCsv(await file.text())
  }

  const run = async (commit: boolean) => {
    if (!csv) return
    setErr(null)
    try {
      const res = await importer.mutateAsync({ kind, csv, commit })
      if (commit) setCommitted(res)
      else setPreview(res)
    } catch (e) {
      setErr((e as { detail?: string; title?: string })?.detail ?? (e as Error)?.message ?? 'Import failed')
    }
  }

  if (!roundId || !round) return <EmptyState>Select a round in the topbar</EmptyState>

  return (
    <>
      <AdminPageHeader
        title="Results Ingestion"
        subtitle={`RD ${String(round.sequence).padStart(2, '0')} · ${round.circuit ?? round.name} — stage the Al Kamel CSV, review, then commit.`}
      />

      {/* Result type */}
      <div className="mb-4 flex gap-3">
        {(['qualifying', 'race'] as ResultKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k)
              reset()
            }}
            className={`flex-1 rounded-[6px] border px-4 py-3 text-left transition-colors ${
              kind === k ? 'border-brand bg-brand/[0.06]' : 'border-line bg-surface hover:border-line-3'
            }`}
          >
            <div className="font-display text-[14px] font-semibold uppercase tracking-[0.03em] text-ink">
              {k === 'qualifying' ? 'Qualifying' : 'Race'}
            </div>
            <div className="font-mono text-[10px] text-muted">
              {k === 'qualifying' ? 'Grid positions · best lap' : 'Finishing order · classification'}
            </div>
          </button>
        ))}
      </div>

      {/* Source */}
      <div className="mb-5 flex items-center gap-3 rounded-[6px] border border-line bg-surface px-4 py-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
          className="hidden"
        />
        <GhostButton onClick={() => fileRef.current?.click()}>Choose CSV</GhostButton>
        <span className="flex-1 truncate font-mono text-[12px] text-muted">
          {fileName ?? 'No file selected — Al Kamel results export (.csv)'}
        </span>
        {csv && (
          <PrimaryButton onClick={() => run(false)} disabled={importer.isPending}>
            {importer.isPending && !committed ? 'Staging…' : 'Stage Preview'}
          </PrimaryButton>
        )}
      </div>

      {err && (
        <div className="mb-5 rounded-[6px] border border-danger/40 bg-danger/[0.08] px-4 py-3 font-mono text-[12px] text-danger">
          {err}
        </div>
      )}

      {committed ? (
        <CommitResult res={committed} onReset={reset} />
      ) : preview ? (
        <PreviewView res={preview} onCommit={() => run(true)} committing={importer.isPending} />
      ) : (
        !err && <EmptyState>Choose a CSV and stage a preview to see matched/unmatched rows</EmptyState>
      )}
    </>
  )
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: 'ink' | 'success' | 'warn' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">{label}</span>
      <span className={`font-mono text-[16px] ${color}`}>{value}</span>
    </div>
  )
}

function PreviewView({
  res,
  onCommit,
  committing,
}: {
  res: IngestResponse
  onCommit: () => void
  committing: boolean
}) {
  const byClassName = (name: string) => classMeta(name)
  // Group results by className directly (byClass carries counts only).
  const classNames = Array.from(new Set(res.results.map((r) => r.className)))

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[6px] border border-line bg-surface px-5 py-3">
        <StatChip label="Parsed" value={res.parsed} tone="ink" />
        <StatChip label="Matched" value={res.matched} tone="success" />
        <StatChip label="Unmatched" value={res.unmatched} tone={res.unmatched > 0 ? 'warn' : 'ink'} />
        <div className="ml-auto flex items-center gap-3">
          {res.unmatched > 0 && (
            <span className="font-mono text-[11px] text-warn">{res.unmatched} will be skipped on commit</span>
          )}
          <PrimaryButton onClick={onCommit} disabled={committing || res.matched === 0}>
            {committing ? 'Committing…' : 'Commit Results'}
          </PrimaryButton>
        </div>
      </div>

      {classNames.map((cn) => {
        const rows = res.results.filter((r) => r.className === cn)
        const isQuali = rows.some((r) => r.lapMs != null)
        return (
          <div key={cn} className="overflow-hidden rounded-[6px] border border-line bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2">
              <ClassSwatch hex={byClassName(cn).hex} />
              <span className="font-display text-[13px] font-semibold uppercase text-ink">{cn}</span>
              <span className="font-mono text-[10px] text-muted-2">{rows.length} classified</span>
            </div>
            <div className="grid grid-cols-[4rem_4rem_1fr] gap-x-3 border-b border-line px-4 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
              <div>Pos</div>
              <div>No.</div>
              <div>{isQuali ? 'Best Lap' : 'Status / Laps'}</div>
            </div>
            {rows.map((r) => (
              <div
                key={`${cn}-${r.number}`}
                className="grid grid-cols-[4rem_4rem_1fr] items-center gap-x-3 border-b border-line px-4 py-2 last:border-b-0"
              >
                <div className="font-mono text-[13px] font-semibold text-ink">P{r.position}</div>
                <div
                  className="border-l-[3px] pl-2 font-mono text-[13px] text-ink-2"
                  style={{ borderColor: byClassName(cn).hex }}
                >
                  {r.number}
                </div>
                <div className="font-mono text-[12px] text-muted">
                  {isQuali ? fmtLap(r.lapMs) : `${r.status ?? '—'}${r.laps != null ? ` · ${r.laps} laps` : ''}`}
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {res.issues.length > 0 && <IssuesPanel issues={res.issues} />}
    </div>
  )
}

function IssuesPanel({ issues }: { issues: IngestResponse['issues'] }) {
  return (
    <div className="rounded-[6px] border border-warn/40 bg-warn/[0.05] p-4">
      <div className="mb-3 font-mono text-[10px] tracking-[0.14em] uppercase text-warn">
        {issues.length} unmatched — fix the catalog / entry list and re-stage
      </div>
      <div className="grid gap-1">
        {issues.map((i, idx) => (
          <div key={idx} className="flex items-center gap-3 font-mono text-[11px]">
            <span className="w-12 text-ink-2">#{i.number}</span>
            <span className="w-20 uppercase text-muted">{i.class}</span>
            <span className="text-muted-2">{i.reason}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CommitResult({ res, onReset }: { res: IngestResponse; onReset: () => void }) {
  return (
    <div className="rounded-[6px] border border-success/40 bg-success/[0.06] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-[7px] w-[7px] rounded-full bg-success" />
        <span className="font-display text-[15px] font-semibold uppercase tracking-[0.03em] text-ink">
          Committed
        </span>
      </div>
      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
        <StatChip label="Inserted" value={res.inserted ?? 0} tone="success" />
        <StatChip label="Updated" value={res.updated ?? 0} tone="ink" />
        <StatChip label="Skipped" value={res.skipped ?? 0} tone={res.skipped ? 'warn' : 'ink'} />
      </div>
      <div className="flex items-center gap-3">
        <GhostButton onClick={onReset}>Ingest Another</GhostButton>
        <span className="font-sans text-[12px] text-muted">
          Sessions marked published · run scoring next under Scoring.
        </span>
      </div>
      {res.issues.length > 0 && <div className="mt-4"><IssuesPanel issues={res.issues} /></div>}
    </div>
  )
}

function fmtLap(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const m = Math.floor(ms / 60000)
  const s = ((ms % 60000) / 1000).toFixed(3)
  return `${m}:${s.padStart(6, '0')}`
}
