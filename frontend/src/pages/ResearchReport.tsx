import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, Play, RefreshCw, ListPlus, Loader2 } from 'lucide-react'
import {
  fetchReport,
  fetchScanRuns,
  triggerFullScan,
  buildFocusList,
  type ScanRun,
  type StrategyReport,
} from '@/lib/api/research'

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function statusColor(status: string): string {
  if (status === 'COMPLETED') return 'text-bullish'
  if (status === 'FAILED') return 'text-bearish'
  return 'text-warning'
}

export default function ResearchReport() {
  const [report, setReport] = useState<StrategyReport | null>(null)
  const [runs, setRuns] = useState<ScanRun[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, s] = await Promise.all([
        fetchReport().catch(() => null),
        fetchScanRuns().catch(() => []),
      ])
      setReport(r)
      setRuns(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleAction = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  const condition = report?.marketCondition.universe ?? report?.marketCondition.index

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <FlaskConical className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            Research Report
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            label="Run Full Scan"
            icon={Play}
            busy={busy === 'scan'}
            onClick={() => handleAction('scan', triggerFullScan)}
          />
          <ActionButton
            label="Build Focus List"
            icon={ListPlus}
            busy={busy === 'focus'}
            onClick={() => handleAction('focus', () => buildFocusList())}
          />
          <ActionButton
            label="Refresh"
            icon={RefreshCw}
            busy={loading}
            variant="ghost"
            onClick={() => void load()}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-bearish/30 bg-bearish/10 px-3 py-2 text-xs text-bearish sm:text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-6">
            <p className="text-xs uppercase tracking-wide text-text-muted sm:text-sm">
              {report?.date ?? 'No report yet'}
            </p>
            <p className="mt-1 text-sm text-text-primary sm:text-base lg:text-lg">
              {report?.summary ?? 'Run a full scan to generate the first report.'}
            </p>
            {condition && (
              <div className="mt-3 flex flex-wrap gap-2">
                <ScorePill label="Trend" value={condition.trendScore} />
                <ScorePill label="Breadth" value={condition.breadthScore} />
                <ScorePill label="Leaders" value={condition.leaderScore} />
                <ScorePill label="Confidence" value={condition.confidenceScore} />
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5">
              <h2 className="mb-3 font-heading text-base font-semibold text-text-primary sm:text-lg">
                Top Candidates ({report?.topCandidates.length ?? 0})
              </h2>
              {report && report.topCandidates.length > 0 ? (
                <div className="space-y-1.5">
                  {report.topCandidates.map((c) => (
                    <div
                      key={c.ticker}
                      className="flex items-center justify-between rounded-lg border border-border-muted px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-sm font-bold text-text-primary">
                          {c.ticker}
                        </span>
                        <BiasBadge bias={c.bias} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted sm:text-xs">
                        <span>{c.reason.replace(/_/g, ' ').toLowerCase()}</span>
                        <span className="font-mono text-text-secondary">
                          {c.priorityScore}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyHint text="No focus candidates yet." />
              )}
            </section>

            <section className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5">
              <h2 className="mb-3 font-heading text-base font-semibold text-text-primary sm:text-lg">
                Active Catalysts ({report?.catalysts.length ?? 0})
              </h2>
              {report && report.catalysts.length > 0 ? (
                <div className="space-y-2">
                  {report.catalysts.map((cat) => (
                    <div key={cat.id} className="rounded-lg border border-border-muted px-3 py-2">
                      <p className="text-sm font-medium text-text-primary">{cat.title}</p>
                      <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">
                        {cat.hypothesis}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyHint text="No active catalysts." />
              )}
            </section>
          </div>

          <section className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5">
            <h2 className="mb-3 font-heading text-base font-semibold text-text-primary sm:text-lg">
              Recent Scan Runs
            </h2>
            {runs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="text-text-muted">
                    <tr className="border-b border-border-muted">
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Duration</th>
                      <th className="py-2 pr-4 font-medium">Stocks</th>
                      <th className="py-2 pr-4 font-medium">Focus</th>
                      <th className="py-2 font-medium">Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id} className="border-b border-border-muted/50">
                        <td className="py-2 pr-4 text-text-secondary">{run.type}</td>
                        <td className={`py-2 pr-4 font-medium ${statusColor(run.status)}`}>
                          {run.status}
                        </td>
                        <td className="py-2 pr-4 font-mono text-text-secondary">
                          {formatDuration(run.durationMs)}
                        </td>
                        <td className="py-2 pr-4 font-mono text-text-secondary">
                          {run.stockCount ?? '—'}
                        </td>
                        <td className="py-2 pr-4 font-mono text-text-secondary">
                          {run.focusListCount ?? '—'}
                        </td>
                        <td className="py-2 text-text-muted">
                          {new Date(run.startedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyHint text="No scan runs yet." />
            )}
          </section>
        </>
      )}
    </div>
  )
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  busy,
  variant = 'solid',
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  busy?: boolean
  variant?: 'solid' | 'ghost'
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={
        variant === 'solid'
          ? 'flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 cursor-pointer sm:px-4 sm:py-2 sm:text-sm'
          : 'flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50 cursor-pointer sm:px-4 sm:py-2 sm:text-sm'
      }
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
      ) : (
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      )}
      {label}
    </button>
  )
}

function ScorePill({ label, value }: { label: string; value: string | null }) {
  const num = value != null ? Math.round(Number(value)) : null
  return (
    <span className="rounded-md border border-border-muted bg-secondary px-2 py-1 text-[10px] text-text-secondary sm:text-xs">
      {label}: <span className="font-mono text-text-primary">{num ?? '—'}</span>
    </span>
  )
}

function BiasBadge({ bias }: { bias: string }) {
  const color =
    bias === 'LONG'
      ? 'bg-bullish/10 text-bullish'
      : bias === 'SHORT'
        ? 'bg-bearish/10 text-bearish'
        : bias === 'BOTH'
          ? 'bg-accent/10 text-accent'
          : 'bg-secondary text-text-muted'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium sm:text-xs ${color}`}>
      {bias}
    </span>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-24 items-center justify-center">
      <span className="text-xs text-text-muted sm:text-sm">{text}</span>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
    </div>
  )
}
