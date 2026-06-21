import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { StockChart } from '@/components/StockChart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  fetchSetupAuditItems,
  fetchSetupAuditModelReviews,
  fetchSetupAuditRuns,
  fetchSetupAuditSummary,
  type ModelReviewAudit,
  type SetupAuditDetectedSetup,
  type SetupScanAuditItem,
  type SetupScanAuditRun,
  type SetupScanAuditStatus,
  type SetupScanAuditSummary,
  type SetupScanFocusStatus,
} from '@/lib/api/research'
import { cn, formatCompactNumber, formatPrice } from '@/lib/utils'
import type { ApiSetup, ApiStockDaily } from '@/types'
import {
  extractModelReviewSummary,
  formatAuditReasonCode,
  parseDetectedSetups,
  toStringArray,
} from './setup-audit.selectors'

const PAGE_SIZES = [12, 24, 36, 48] as const
const DEFAULT_PAGE_SIZE = 24

const SCAN_TABS: Array<{ value: 'ALL' | SetupScanAuditStatus; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'DETECTED', label: 'Detected' },
  { value: 'NO_SETUP', label: 'No setup' },
  { value: 'DEDUPED', label: 'Deduped' },
  { value: 'SUPPRESSED', label: 'Suppressed' },
  { value: 'INSUFFICIENT_DATA', label: 'Thin data' },
  { value: 'INPUT_FILTERED', label: 'Filtered' },
  { value: 'ERROR', label: 'Errors' },
]

const SETUP_TYPES = [
  'VCP',
  'BREAKOUT_PIVOT',
  'FAIL_BREAKOUT',
  'FAIL_BASE',
  'HIGH_TIGHT_FLAG',
  'PULLBACK_BUY',
  'UNDERCUT_RALLY',
  'DOUBLE_TOP',
  'EMA20_PULLBACK',
  'MA_RALLY_FAILURE',
  'EMA200_KEY_LEVEL',
]

const STATUS_TONE: Record<string, string> = {
  DETECTED: 'border-bullish/30 bg-bullish/12 text-bullish',
  NO_SETUP: 'border-border bg-secondary text-text-secondary',
  DEDUPED: 'border-warning/30 bg-warning/12 text-warning',
  SUPPRESSED: 'border-bearish/30 bg-bearish/12 text-bearish',
  INSUFFICIENT_DATA: 'border-warning/30 bg-warning/12 text-warning',
  INPUT_FILTERED: 'border-border bg-bg-elevated text-text-muted',
  ERROR: 'border-bearish/30 bg-bearish/12 text-bearish',
  INCLUDED: 'border-bullish/30 bg-bullish/12 text-bullish',
  EXCLUDED: 'border-border bg-secondary text-text-secondary',
  NOT_EVALUATED: 'border-border bg-bg-elevated text-text-muted',
}

export default function SetupAudit() {
  const [runs, setRuns] = useState<SetupScanAuditRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [summary, setSummary] = useState<SetupScanAuditSummary | null>(null)
  const [items, setItems] = useState<SetupScanAuditItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [scanStatus, setScanStatus] = useState<'ALL' | SetupScanAuditStatus>('ALL')
  const [focusStatus, setFocusStatus] = useState<'ALL' | SetupScanFocusStatus>('ALL')
  const [setupType, setSetupType] = useState('ALL')
  const [queryDraft, setQueryDraft] = useState('')
  const [query, setQuery] = useState('')
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true)
    setError(null)
    try {
      const payload = await fetchSetupAuditRuns()
      setRuns(payload)
      setSelectedRunId((current) => current || payload[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit runs')
    } finally {
      setLoadingRuns(false)
    }
  }, [])

  const loadItems = useCallback(async () => {
    if (!selectedRunId) return
    setLoadingItems(true)
    setError(null)
    try {
      const [nextSummary, payload] = await Promise.all([
        fetchSetupAuditSummary(selectedRunId),
        fetchSetupAuditItems(selectedRunId, {
          page,
          limit,
          scanStatus: scanStatus === 'ALL' ? undefined : scanStatus,
          focusStatus: focusStatus === 'ALL' ? undefined : focusStatus,
          setupType: setupType === 'ALL' ? undefined : setupType,
          q: query || undefined,
        }),
      ])
      setSummary(nextSummary)
      setItems(payload.items)
      setTotal(payload.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load setup audit')
      setItems([])
      setTotal(0)
    } finally {
      setLoadingItems(false)
    }
  }, [focusStatus, limit, page, query, scanStatus, selectedRunId, setupType])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  )
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setQuery(queryDraft.trim())
  }

  function resetPage(next: () => void) {
    setPage(1)
    next()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ClipboardList className="h-6 w-6 shrink-0 text-accent" />
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-text-primary lg:text-3xl">
              Setup Audit
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span>{selectedRun ? formatWhen(selectedRun.startedAt) : 'No run selected'}</span>
              {selectedRun?.scanRunId ? (
                <span className="font-mono">scan {selectedRun.scanRunId.slice(0, 8)}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedRunId}
            onValueChange={(value) =>
              resetPage(() => {
                setSelectedRunId(value)
              })
            }
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder={loadingRuns ? 'Loading runs' : 'Select run'} />
            </SelectTrigger>
            <SelectContent>
              {runs.map((run) => (
                <SelectItem key={run.id} value={run.id}>
                  {formatWhen(run.startedAt)} - {run.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void loadItems()} disabled={!selectedRunId || loadingItems}>
            {loadingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-bearish/30 bg-bearish/10 px-3 py-2 text-sm text-bearish">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <SummaryStrip summary={summary} run={selectedRun} />

      <div className="space-y-3 rounded-lg border border-border-default bg-bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          {SCAN_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() =>
                resetPage(() => {
                  setScanStatus(tab.value)
                })
              }
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                scanStatus === tab.value
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_160px_190px_120px]">
          <form onSubmit={handleSearch} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Ticker, company, reason"
              className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </form>
          <Select
            value={focusStatus}
            onValueChange={(value) =>
              resetPage(() => {
                setFocusStatus(value as typeof focusStatus)
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All focus states</SelectItem>
              <SelectItem value="INCLUDED">Included</SelectItem>
              <SelectItem value="EXCLUDED">Excluded</SelectItem>
              <SelectItem value="NOT_EVALUATED">Not evaluated</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={setupType}
            onValueChange={(value) =>
              resetPage(() => {
                setSetupType(value)
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All setup types</SelectItem>
              {SETUP_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(limit)}
            onValueChange={(value) =>
              resetPage(() => {
                setLimit(Number(value))
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} cards
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingItems ? (
        <div className="flex h-56 items-center justify-center rounded-lg border border-border-default bg-bg-surface">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-surface text-sm text-text-muted">
          No audit items match this view.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => (
            <AuditCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-bg-surface px-4 py-3">
        <span className="text-xs text-text-muted sm:text-sm">
          Showing {total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-xs text-text-secondary">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function SummaryStrip({
  summary,
  run,
}: {
  summary: SetupScanAuditSummary | null
  run: SetupScanAuditRun | null
}) {
  const scanCounts = summary?.scanStatusCounts ?? {}
  const focusCounts = summary?.focusStatusCounts ?? {}
  const metrics = [
    { label: 'Inputs', value: run?.inputCount ?? 0, tone: 'text-text-primary' },
    { label: 'Candidates', value: run?.candidateCount ?? 0, tone: 'text-accent' },
    { label: 'Detected', value: scanCounts.DETECTED ?? 0, tone: 'text-bullish' },
    { label: 'No setup', value: scanCounts.NO_SETUP ?? 0, tone: 'text-text-secondary' },
    { label: 'Filtered', value: scanCounts.INPUT_FILTERED ?? 0, tone: 'text-text-muted' },
    { label: 'Focus', value: focusCounts.INCLUDED ?? 0, tone: 'text-warning' },
  ]
  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-lg border border-border-default bg-bg-surface px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{metric.label}</div>
          <div className={cn('mt-1 font-heading text-2xl font-bold', metric.tone)}>{metric.value}</div>
        </div>
      ))}
    </div>
  )
}

function AuditCard({ item }: { item: SetupScanAuditItem }) {
  const [reviews, setReviews] = useState<ModelReviewAudit[] | null>(null)
  const [loadingReviews, setLoadingReviews] = useState(false)
  const detectedSetups = parseDetectedSetups(item.detectedSetupsJson)
  const bars = normalizeBars(item.dailyBars)
  const chartSetups = detectedSetups.map(toChartSetup)
  const scanReasons = buildScanReasonGroups(item, detectedSetups)

  async function loadReviews() {
    if (reviews || loadingReviews) return
    setLoadingReviews(true)
    try {
      setReviews(await fetchSetupAuditModelReviews(item.id))
    } finally {
      setLoadingReviews(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-lg border border-border-default bg-bg-surface [content-visibility:auto] [contain-intrinsic-size:720px]">
      <div className="border-b border-border-muted bg-bg-elevated/70 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-text-primary">{item.ticker}</h2>
              <StatusBadge value={item.scanStatus} />
              <StatusBadge value={item.focusStatus} />
            </div>
            <p className="mt-1 truncate text-xs text-text-secondary">
              {item.name ?? 'Unknown'}{item.sector ? ` / ${item.sector}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-right font-mono text-xs text-text-secondary">
            <div>{item.latestClose != null ? `$${formatPrice(Number(item.latestClose))}` : '--'}</div>
            <div>{item.avgVolume != null ? formatCompactNumber(Number(item.avgVolume)) : '--'} vol</div>
          </div>
        </div>
      </div>

      <StockChart dailyBars={bars} setups={chartSetups} height={220} priority={false} />

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {toStringArray(item.reasonCodesJson).map((reason) => (
            <Badge key={reason} variant="secondary" className="text-[10px]">
              {formatAuditReasonCode(reason)}
            </Badge>
          ))}
        </div>

        {item.reasonText ? (
          <p className="text-xs leading-5 text-text-secondary">{item.reasonText}</p>
        ) : null}

        <ReasonGroups acceptReasons={scanReasons.accept} rejectReasons={scanReasons.reject} />

        {detectedSetups.length > 0 ? (
          <div className="space-y-2">
            {detectedSetups.map((setup, index) => (
              <SetupRow key={`${setup.type}-${setup.detectedAt ?? index}`} setup={setup} />
            ))}
          </div>
        ) : null}

        {item.focusReason || item.priorityScore != null ? (
          <div className="grid grid-cols-3 gap-2 rounded-md border border-border-muted bg-bg-elevated p-2 text-xs">
            <Metric label="Bias" value={item.setupBias ?? '--'} />
            <Metric label="Focus" value={item.focusReason?.replace(/_/g, ' ') ?? '--'} />
            <Metric label="Score" value={item.priorityScore != null ? String(Math.round(Number(item.priorityScore))) : '--'} />
          </div>
        ) : null}

        <details className="group rounded-md border border-border-muted bg-bg-elevated/60 p-3" onToggle={loadReviews}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-text-primary">
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-accent" />
              Model trail
            </span>
            {loadingReviews ? <Loader2 className="h-4 w-4 animate-spin text-text-muted" /> : null}
          </summary>
          <div className="mt-3 space-y-3">
            {reviews == null || reviews.length === 0 ? (
              <div className="text-xs text-text-muted">{reviews == null ? 'Loading...' : 'No model reviews linked.'}</div>
            ) : (
              reviews.map((review) => <ModelReviewBlock key={review.id} review={review} />)
            )}
          </div>
        </details>
      </div>
    </article>
  )
}

function SetupRow({ setup }: { setup: SetupAuditDetectedSetup }) {
  return (
    <div className="rounded-md border border-border-muted bg-bg-elevated p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-accent/15 text-accent">{setup.type.replace(/_/g, ' ')}</Badge>
        <Badge variant="outline">{setup.direction}</Badge>
        <Badge variant="outline">{setup.outcome ?? setup.state ?? 'scan'}</Badge>
        {setup.detectorSource ? <Badge variant="secondary">{setup.detectorSource}</Badge> : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs text-text-secondary">
        <Metric label="Pivot" value={formatMaybePrice(setup.pivotPrice)} />
        <Metric label="Stop" value={formatMaybePrice(setup.stopPrice)} />
        <Metric label="Target" value={formatMaybePrice(setup.targetPrice)} />
      </div>
      {setup.evidence && setup.evidence.length > 0 ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-muted">{setup.evidence.slice(0, 3).join(' | ')}</p>
      ) : null}
    </div>
  )
}

function ModelReviewBlock({ review }: { review: ModelReviewAudit }) {
  const summary = extractModelReviewSummary(review.resultJson)
  return (
    <div className="space-y-2 rounded-md border border-border-muted bg-bg-base p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{review.reviewType}</Badge>
        <Badge variant="outline">{review.provider}</Badge>
        {summary.verdict ? (
          <Badge className={cn(modelDecisionTone(summary.decision), 'border')}>
            {summary.verdict.replace(/_/g, ' ').toLowerCase()}
          </Badge>
        ) : null}
        <span className="text-text-muted">{formatWhen(review.createdAt)}</span>
      </div>
      <ReasonGroups
        acceptReasons={summary.acceptReasons}
        rejectReasons={summary.rejectReasons}
        neutralReasons={summary.reasons}
        compact
      />
      {review.prompt ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-bg-surface p-2 text-[11px] leading-5 text-text-secondary">
          {review.prompt}
        </pre>
      ) : null}
      <JsonPreview label="Payload" value={review.payloadJson} />
      <JsonPreview label="Result" value={review.resultJson} />
    </div>
  )
}

function ReasonGroups({
  acceptReasons,
  rejectReasons,
  neutralReasons = [],
  compact = false,
}: {
  acceptReasons: string[]
  rejectReasons: string[]
  neutralReasons?: string[]
  compact?: boolean
}) {
  if (acceptReasons.length === 0 && rejectReasons.length === 0 && neutralReasons.length === 0) {
    return null
  }
  return (
    <div className={cn('grid gap-2', compact ? 'text-[11px]' : 'text-xs')}>
      {acceptReasons.length > 0 ? (
        <ReasonList label="Accept reasons" reasons={acceptReasons} tone="accept" />
      ) : null}
      {rejectReasons.length > 0 ? (
        <ReasonList label="Reject reasons" reasons={rejectReasons} tone="reject" />
      ) : null}
      {neutralReasons.length > 0 ? (
        <ReasonList label="Model reasons" reasons={neutralReasons} tone="neutral" />
      ) : null}
    </div>
  )
}

function ReasonList({
  label,
  reasons,
  tone,
}: {
  label: string
  reasons: string[]
  tone: 'accept' | 'reject' | 'neutral'
}) {
  const toneClass =
    tone === 'accept'
      ? 'border-bullish/20 bg-bullish/8 text-bullish'
      : tone === 'reject'
        ? 'border-bearish/20 bg-bearish/8 text-bearish'
        : 'border-border-muted bg-bg-surface text-text-secondary'
  return (
    <div className={cn('rounded-md border px-3 py-2', toneClass)}>
      <div className="mb-1 font-medium uppercase tracking-wide">{label}</div>
      <ul className="space-y-1 leading-5">
        {reasons.slice(0, 5).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  )
}

function JsonPreview({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null
  return (
    <details>
      <summary className="cursor-pointer list-none text-text-muted hover:text-text-primary">{label}</summary>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-bg-surface p-2 text-[11px] leading-5 text-text-secondary">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-0.5 truncate text-text-primary">{value}</div>
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase', STATUS_TONE[value])}>
      {value.replace(/_/g, ' ').toLowerCase()}
    </span>
  )
}

function buildScanReasonGroups(
  item: SetupScanAuditItem,
  detectedSetups: SetupAuditDetectedSetup[],
): { accept: string[]; reject: string[] } {
  const accept = [
    ...(item.scanStatus === 'DETECTED' ? ['Setup detector accepted this ticker'] : []),
    ...(item.focusStatus === 'INCLUDED' ? ['Focus list included this ticker'] : []),
    ...detectedSetups.flatMap((setup) => setup.evidence ?? []),
  ]
  const reject = [
    ...(item.scanStatus !== 'DETECTED' && item.reasonText ? [item.reasonText] : []),
    ...(item.focusStatus === 'EXCLUDED' ? ['Focus list did not include this ticker'] : []),
    ...detectedSetups
      .map((setup) => setup.reason)
      .filter((reason): reason is string => typeof reason === 'string' && reason.length > 0),
  ]
  return {
    accept: [...new Set(accept)].slice(0, 5),
    reject: [...new Set(reject)].slice(0, 5),
  }
}

function modelDecisionTone(decision: string): string {
  if (decision === 'accept') return 'border-bullish/30 bg-bullish/12 text-bullish'
  if (decision === 'reject') return 'border-bearish/30 bg-bearish/12 text-bearish'
  if (decision === 'watch') return 'border-warning/30 bg-warning/12 text-warning'
  return 'border-border bg-secondary text-text-secondary'
}

function normalizeBars(bars: ApiStockDaily[]): ApiStockDaily[] {
  return bars.map((bar) => ({
    ...bar,
    open: Number(bar.open),
    high: Number(bar.high),
    low: Number(bar.low),
    close: Number(bar.close),
    volume: Number(bar.volume),
    sma20: bar.sma20 == null ? null : Number(bar.sma20),
    sma50: bar.sma50 == null ? null : Number(bar.sma50),
    sma150: bar.sma150 == null ? null : Number(bar.sma150),
    sma200: bar.sma200 == null ? null : Number(bar.sma200),
    ema6: bar.ema6 == null ? null : Number(bar.ema6),
    ema20: bar.ema20 == null ? null : Number(bar.ema20),
    rsRank: bar.rsRank == null ? null : Number(bar.rsRank),
    atr14: bar.atr14 == null ? null : Number(bar.atr14),
  }))
}

function toChartSetup(setup: SetupAuditDetectedSetup): ApiSetup {
  return {
    id: setup.setupId ?? `${setup.type}-${setup.detectedAt ?? 'scan'}`,
    stockId: '',
    type: setup.type as ApiSetup['type'],
    timeframe: setup.timeframe as ApiSetup['timeframe'],
    direction: setup.direction as ApiSetup['direction'],
    state: (setup.state ?? 'BUILDING') as ApiSetup['state'],
    detectedAt: setup.detectedAt ?? new Date().toISOString(),
    expiresAt: null,
    lastStateAt: setup.detectedAt ?? new Date().toISOString(),
    pivotPrice: setup.pivotPrice ?? null,
    stopPrice: setup.stopPrice ?? null,
    targetPrice: setup.targetPrice ?? null,
    riskReward: setup.riskReward ?? null,
    evidence: setup.evidence ?? [],
    waitingFor: setup.waitingFor ?? null,
    metadata: {},
    dailyBaseId: null,
    stock: {} as ApiSetup['stock'],
  }
}

function formatMaybePrice(value: number | null | undefined): string {
  return value == null ? '--' : `$${formatPrice(Number(value))}`
}

function formatWhen(value?: string | null): string {
  if (!value) return 'Not finished'
  return new Date(value).toLocaleString()
}
