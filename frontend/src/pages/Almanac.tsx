import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  GitCompareArrows,
  Loader2,
  RefreshCw,
  Search,
  UploadCloud,
} from 'lucide-react'
import { StockChart } from '@/components/StockChart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  fetchAlmanacExplorer,
  fetchAlmanacTradeCaseOhlcv,
  importAlmanacLibrary,
  reviewAlmanacTradeCase,
  type AlmanacExplorerResponse,
  type AlmanacFilters,
  type AlmanacOhlcvResponse,
  type AlmanacSetupPhase,
  type AlmanacTradeCase,
  type AlmanacTradeLabel,
} from '@/lib/api/research'
import { cn } from '@/lib/utils'

const LABELS: AlmanacTradeLabel[] = ['UNCLEAR', 'VALID', 'REFERENCE_ONLY', 'FALSE_POSITIVE']
const YEARS = [2020, 2022]
const QUARTERS = [1, 2, 3, 4]
const REVIEW_CASE_LIMIT = 1200
const PHASES: AlmanacSetupPhase[] = ['APPROACHING', 'TOUCHED', 'TRIGGERED', 'FAILED', 'NEGATIVE', 'REFERENCE']
const DIRECTIONS = ['LONG', 'SHORT'] as const
const EMPTY_TRADE_CASES: AlmanacTradeCase[] = []

const GROUPING_PRESETS = [
  { id: 'time-catalyst-setup-stock', label: 'Time > Catalyst > Setup + Stocks' },
  { id: 'setup-time-stock', label: 'Setup > Time > Stocks' },
  { id: 'stock-setup-time', label: 'Stock > Setup > Time' },
  { id: 'catalyst-time-setup-stock', label: 'Catalyst > Time > Setup + Stocks' },
] as const

type GroupingPreset = (typeof GROUPING_PRESETS)[number]['id']
type AlmanacDirection = (typeof DIRECTIONS)[number]
type ReviewPayload = {
  ticker?: string
  setupTag?: string
  direction?: AlmanacDirection | null
  phase?: AlmanacSetupPhase
  label?: AlmanacTradeLabel
  reviewNotes?: string | null
  chartId?: string | null
}

type DirectoryNode =
  | {
      id: string
      type: 'folder'
      label: string
      count: number
      children: DirectoryNode[]
    }
  | {
      id: string
      type: 'case'
      label: string
      meta: string
      tradeCase: AlmanacTradeCase
    }

export default function Almanac() {
  const [payload, setPayload] = useState<AlmanacExplorerResponse | null>(null)
  const [filters, setFilters] = useState<AlmanacFilters>({ page: 1, limit: REVIEW_CASE_LIMIT })
  const [grouping, setGrouping] = useState<GroupingPreset>('time-catalyst-setup-stock')
  const [queryDraft, setQueryDraft] = useState('')
  const [selectedCaseId, setSelectedCaseId] = useState<string>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtersHidden, setFiltersHidden] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAlmanacExplorer(filters)
      setPayload(data)
      setSelectedCaseId((current) => current || data.tradeCases[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Almanac knowledge')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const loadedCases = payload?.tradeCases ?? EMPTY_TRADE_CASES
  const visibleCases = useMemo(
    () => filterCases(loadedCases, queryDraft),
    [loadedCases, queryDraft],
  )
  const directory = useMemo(
    () => buildDirectoryTree(visibleCases, grouping),
    [grouping, visibleCases],
  )

  useEffect(() => {
    const firstCase = visibleCases[0]
    if (!firstCase) {
      setSelectedCaseId('')
      return
    }
    if (!visibleCases.some((item) => item.id === selectedCaseId)) {
      setSelectedCaseId(firstCase.id)
    }
  }, [selectedCaseId, visibleCases])

  useEffect(() => {
    const next = firstBranch(directory)
    setExpanded((current) => (sameSet(current, next) ? current : next))
  }, [directory, grouping])

  const selectedCase = useMemo(
    () => visibleCases.find((item) => item.id === selectedCaseId) ?? visibleCases[0] ?? null,
    [selectedCaseId, visibleCases],
  )

  const updateFilter = (patch: Partial<AlmanacFilters>) => {
    setFilters((current) => ({ ...current, ...patch, page: 1, limit: REVIEW_CASE_LIMIT }))
    setSelectedCaseId('')
  }

  const handleImport = async () => {
    setBusy('import')
    setError(null)
    try {
      await importAlmanacLibrary({ cleanupUnclear: true, extractImages: false, linkChartsOnly: false })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Almanac import')
    } finally {
      setBusy(null)
    }
  }

  const handleReview = async (tradeCase: AlmanacTradeCase, body: ReviewPayload) => {
    setBusy(tradeCase.id)
    setError(null)
    try {
      await reviewAlmanacTradeCase(tradeCase.id, body)
      setSelectedCaseId(tradeCase.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review')
    } finally {
      setBusy(null)
    }
  }

  const total = payload?.total ?? 0
  const loadedCount = loadedCases.length
  const isCapped = total > loadedCount

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <BookMarked className="h-6 w-6 text-accent" />
            <h1 className="font-heading text-2xl font-bold tracking-tight text-text-primary lg:text-3xl">
              Gilmo Almanac
            </h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            Review text-backed setup candidates against source wording and recreated OHLCV context.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button type="button" className="gap-2" onClick={() => void handleImport()} disabled={busy === 'import'}>
            {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Rebuild Text Cases
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-bearish/30 bg-bearish/10 px-3 py-2 text-sm text-bearish">
          {error}
        </div>
      ) : null}

      <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="flex min-h-[560px] flex-col overflow-hidden rounded-md border border-border-default bg-bg-surface lg:sticky lg:top-3 lg:h-[calc(100vh-112px)]">
          <div className="border-b border-border-default p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Folder className="h-4 w-4 text-accent" />
                Directory
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">
                  {visibleCases.length.toLocaleString()} / {total.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => setFiltersHidden((current) => !current)}
                  className="rounded border border-border-muted px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                >
                  {filtersHidden ? 'Show Filters' : 'Hide Filters'}
                </button>
              </div>
            </div>

            {!filtersHidden ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs text-text-muted">Show As</span>
                  <select
                    value={grouping}
                    onChange={(event) => setGrouping(event.target.value as GroupingPreset)}
                    className="w-full rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  >
                    {GROUPING_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <FilterSelect
                    label="Year"
                    value={filters.year ? String(filters.year) : 'ALL'}
                    options={YEARS.map(String)}
                    onChange={(value) => updateFilter({ year: value === 'ALL' ? undefined : Number(value) })}
                  />
                  <FilterSelect
                    label="Quarter"
                    value={filters.quarter ? String(filters.quarter) : 'ALL'}
                    options={QUARTERS.map(String)}
                    onChange={(value) => updateFilter({ quarter: value === 'ALL' ? undefined : Number(value) })}
                  />
                </div>

                <div className="mt-3 grid gap-2">
                  <FilterSelect
                    label="Setup"
                    value={filters.setupTag ?? 'ALL'}
                    options={payload?.facets.setupTaxonomy ?? []}
                    onChange={(value) => updateFilter({ setupTag: value === 'ALL' ? undefined : value })}
                  />
                  <FilterSelect
                    label="Ticker"
                    value={filters.ticker ?? 'ALL'}
                    options={(payload?.facets.tickers ?? []).map((item) => item.value)}
                    onChange={(value) => updateFilter({ ticker: value === 'ALL' ? undefined : value })}
                  />
                  <FilterSelect
                    label="Label"
                    value={filters.label ?? 'ALL'}
                    options={LABELS}
                    onChange={(value) => updateFilter({ label: value === 'ALL' ? undefined : (value as AlmanacTradeLabel) })}
                  />
                </div>

                <label className="mt-3 block">
                  <span className="mb-1 block text-xs text-text-muted">Search Loaded Directory</span>
                  <div className="flex items-center gap-2 rounded-md border border-border-default bg-bg-elevated px-2">
                    <Search className="h-4 w-4 text-text-muted" />
                    <input
                      value={queryDraft}
                      onChange={(event) => setQueryDraft(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none"
                      placeholder="ticker, setup, analysis, report"
                    />
                  </div>
                </label>

                {isCapped ? (
                  <p className="mt-2 rounded border border-warning/30 bg-warning/10 px-2 py-1.5 text-xs text-warning">
                    Showing first {loadedCount.toLocaleString()} candidates. Narrow filters for the rest.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="rounded border border-border-muted bg-bg-elevated px-2 py-1.5 text-xs text-text-muted">
                Filters hidden. Directory keeps the current selection.
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-sm text-text-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading directory
              </div>
            ) : directory.length === 0 ? (
              <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-text-muted">
                No candidates match the current filters.
              </div>
            ) : (
              <DirectoryTree
                nodes={directory}
                expanded={expanded}
                selectedCaseId={selectedCase?.id ?? ''}
                onToggle={(id) =>
                  setExpanded((current) => {
                    const next = new Set(current)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
                onSelect={setSelectedCaseId}
              />
            )}
          </div>
        </aside>

        <section className="min-h-[560px] overflow-hidden rounded-md border border-border-default bg-bg-surface lg:h-[calc(100vh-112px)]">
          <EvidencePanel
            tradeCase={selectedCase}
            busy={selectedCase ? busy === selectedCase.id : false}
            setupOptions={payload?.facets.setupTaxonomy ?? []}
            onReview={(body) => {
              if (selectedCase) void handleReview(selectedCase, body)
            }}
          />
        </section>
      </section>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="ALL">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
    </label>
  )
}

function DirectoryTree({
  nodes,
  expanded,
  selectedCaseId,
  onToggle,
  onSelect,
  level = 0,
}: {
  nodes: DirectoryNode[]
  expanded: Set<string>
  selectedCaseId: string
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  level?: number
}) {
  return (
    <div className={cn(level > 0 && 'ml-3 border-l border-border-muted pl-2')}>
      {nodes.map((node) => {
        if (node.type === 'folder') {
          const isOpen = expanded.has(node.id)
          return (
            <div key={node.id}>
              <button
                type="button"
                onClick={() => onToggle(node.id)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Folder className="h-3.5 w-3.5 text-accent" />
                <span className="min-w-0 flex-1 truncate">{node.label}</span>
                <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">{node.count}</span>
              </button>
              {isOpen ? (
                <DirectoryTree
                  nodes={node.children}
                  expanded={expanded}
                  selectedCaseId={selectedCaseId}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  level={level + 1}
                />
              ) : null}
            </div>
          )
        }

        const active = selectedCaseId === node.tradeCase.id
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelect(node.tradeCase.id)}
            className={cn(
              'my-0.5 flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors',
              active ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
            )}
          >
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{node.label}</span>
              <span className="mt-0.5 block truncate text-[10px] text-text-muted">{node.meta}</span>
            </span>
            <Badge className={cn('shrink-0 text-[9px]', labelTone(node.tradeCase.label))}>
              {shortLabel(node.tradeCase.label)}
            </Badge>
          </button>
        )
      })}
    </div>
  )
}

function ReviewButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-50',
        active
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-border-muted text-text-secondary hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}

function EvidencePanel({
  tradeCase,
  busy,
  setupOptions,
  onReview,
}: {
  tradeCase: AlmanacTradeCase | null
  busy: boolean
  setupOptions: string[]
  onReview: (body: ReviewPayload) => void
}) {
  const tickerRef = useRef<HTMLInputElement | null>(null)
  const setupRef = useRef<HTMLSelectElement | null>(null)
  const directionRef = useRef<HTMLSelectElement | null>(null)
  const phaseRef = useRef<HTMLSelectElement | null>(null)
  const [ticker, setTicker] = useState('')
  const [setupTag, setSetupTag] = useState('')
  const [direction, setDirection] = useState<AlmanacDirection | ''>('')
  const [phase, setPhase] = useState<AlmanacSetupPhase>('REFERENCE')
  const [label, setLabel] = useState<AlmanacTradeLabel>('UNCLEAR')
  const [reviewNotes, setReviewNotes] = useState('')
  const [ohlcv, setOhlcv] = useState<AlmanacOhlcvResponse | null>(null)
  const [ohlcvLoading, setOhlcvLoading] = useState(false)
  const [ohlcvError, setOhlcvError] = useState<string | null>(null)
  const [excerptExpanded, setExcerptExpanded] = useState(false)

  useEffect(() => {
    if (!tradeCase) return
    setTicker(tradeCase.ticker)
    setSetupTag(tradeCase.setupTag)
    setDirection(tradeCase.direction ?? '')
    setPhase(tradeCase.phase)
    setLabel(tradeCase.label)
    setReviewNotes(tradeCase.reviewNotes ?? '')
    setExcerptExpanded(false)
  }, [tradeCase])

  useEffect(() => {
    if (!tradeCase) {
      setOhlcv(null)
      return
    }
    let cancelled = false
    setOhlcvLoading(true)
    setOhlcvError(null)
    void fetchAlmanacTradeCaseOhlcv(tradeCase.id)
      .then((data) => {
        if (!cancelled) setOhlcv(data)
      })
      .catch((err) => {
        if (!cancelled) setOhlcvError(err instanceof Error ? err.message : 'Failed to load OHLCV chart')
      })
      .finally(() => {
        if (!cancelled) setOhlcvLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tradeCase?.id, tradeCase?.ticker, tradeCase?.report?.reportDate])

  if (!tradeCase) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-text-muted">
        Select a trade case to inspect evidence.
      </div>
    )
  }

  const catalystTags = toStringArray(tradeCase.catalystTagsJson)
  const mindsetTags = toStringArray(tradeCase.mindsetTagsJson)
  const availableSetupOptions = Array.from(new Set([setupTag, tradeCase.setupTag, ...setupOptions].filter(Boolean)))

  const focusField = (field: 'ticker' | 'setup' | 'direction' | 'phase') => {
    window.requestAnimationFrame(() => {
      if (field === 'ticker') tickerRef.current?.focus()
      if (field === 'setup') setupRef.current?.focus()
      if (field === 'direction') directionRef.current?.focus()
      if (field === 'phase') phaseRef.current?.focus()
    })
  }

  const markWrong = (field: 'ticker' | 'setup' | 'direction' | 'phase') => {
    setLabel('UNCLEAR')
    setReviewNotes((current) => current || `Needs ${field} correction.`)
    focusField(field)
  }

  const saveReview = () => {
    onReview({
      ticker: ticker.trim().toUpperCase(),
      setupTag,
      direction: direction || null,
      phase,
      label,
      reviewNotes: reviewNotes.trim() || null,
    })
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-md border border-border-default bg-bg-surface p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Recreated OHLCV</h2>
            </div>
            {ohlcv ? <Badge variant="outline">{ohlcv.status.replaceAll('_', ' ')}</Badge> : null}
          </div>

          {ohlcvLoading ? (
            <div className="flex h-72 items-center justify-center text-sm text-text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading historical bars
            </div>
          ) : ohlcvError ? (
            <div className="flex h-72 items-center justify-center rounded border border-dashed border-border-default px-4 text-center text-sm text-bearish">
              {ohlcvError}
            </div>
          ) : ohlcv && ohlcv.bars.length > 0 ? (
            <>
              <StockChart dailyBars={ohlcv.bars} height={320} showMAs priority />
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-muted">
                <span>{ohlcv.ticker}</span>
                <span>{ohlcv.windowStart} to {ohlcv.windowEnd}</span>
                <span>{ohlcv.bars.length} bars</span>
                {ohlcv.reportDate ? <span>Report {ohlcv.reportDate}</span> : null}
              </div>
            </>
          ) : (
            <div className="flex h-72 items-center justify-center rounded border border-dashed border-border-default px-4 text-center text-sm text-text-muted">
              {ohlcv?.message ?? 'No OHLCV chart available for this candidate.'}
            </div>
          )}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3 rounded-md border border-border-default bg-bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary">Analysis / Source Wording</h2>
                </div>
                <p className="mt-1 text-xs text-text-muted">{tradeCase.source.title ?? tradeCase.source.pdfFileName}</p>
              </div>
              <Badge className={labelTone(tradeCase.label)}>{tradeCase.label.replaceAll('_', ' ')}</Badge>
            </div>
            <InfoRow label="Ticker" value={tradeCase.ticker} />
            <InfoRow label="Setup" value={tradeCase.setupTag.replaceAll('_', ' ')} />
            <InfoRow label="Direction" value={tradeCase.direction ?? '-'} />
            <InfoRow label="Phase" value={tradeCase.phase.replaceAll('_', ' ')} />
            <InfoRow label="Report" value={tradeCase.report?.title ?? '-'} />
            <InfoRow label="Period" value={formatPeriod(tradeCase)} />
            <InfoRow label="Source page" value={String(tradeCase.sourcePage)} />
            <InfoRow label="Confidence" value={tradeCase.sourceConfidence} />

            <TagGroup label="Catalysts" tags={catalystTags} />
            <TagGroup label="Mindset" tags={mindsetTags} />

            {tradeCase.sourceExcerpt ? (
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-text-muted">Source analysis</div>
                  <button
                    type="button"
                    onClick={() => setExcerptExpanded((current) => !current)}
                    className="rounded border border-border-muted px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    {excerptExpanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>
                <p
                  className={cn(
                    'rounded border border-border-muted bg-bg-elevated p-2 text-xs leading-relaxed text-text-secondary whitespace-pre-wrap',
                    excerptExpanded ? 'max-h-96 overflow-y-auto' : 'max-h-40 overflow-hidden',
                  )}
                >
                  {tradeCase.sourceExcerpt}
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-md border border-border-default bg-bg-surface p-3">
            <div>
              <div className="text-sm font-semibold text-text-primary">Review Extraction</div>
              <p className="text-xs text-text-muted">Validate the ticker, setup, direction, phase, and source wording.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ReviewButton
                disabled={busy}
                active={label === 'VALID'}
                onClick={() => onReview({ label: 'VALID', reviewNotes: reviewNotes || 'Reviewed as correct.' })}
              >
                Correct
              </ReviewButton>
              <ReviewButton disabled={busy} onClick={() => markWrong('setup')}>
                Wrong Setup
              </ReviewButton>
              <ReviewButton disabled={busy} onClick={() => markWrong('ticker')}>
                Wrong Ticker
              </ReviewButton>
              <ReviewButton disabled={busy} onClick={() => markWrong('direction')}>
                Wrong Direction
              </ReviewButton>
              <ReviewButton disabled={busy} onClick={() => markWrong('phase')}>
                Wrong Phase
              </ReviewButton>
              <ReviewButton
                disabled={busy}
                active={label === 'FALSE_POSITIVE'}
                onClick={() => onReview({ label: 'FALSE_POSITIVE', reviewNotes: reviewNotes || 'Not a trade/setup example.' })}
              >
                Not A Trade
              </ReviewButton>
              <ReviewButton
                disabled={busy}
                active={label === 'REFERENCE_ONLY'}
                onClick={() => onReview({ label: 'REFERENCE_ONLY', reviewNotes: reviewNotes || 'Reference only.' })}
              >
                Reference Only
              </ReviewButton>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-text-muted">Ticker</span>
              <input
                ref={tickerRef}
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
                className="w-full rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-text-muted">Setup</span>
              <select
                ref={setupRef}
                value={setupTag}
                onChange={(event) => setSetupTag(event.target.value)}
                className="w-full rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
              >
                {availableSetupOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">Direction</span>
                <select
                  ref={directionRef}
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as AlmanacDirection | '')}
                  className="w-full rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="">None</option>
                  {DIRECTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">Phase</span>
                <select
                  ref={phaseRef}
                  value={phase}
                  onChange={(event) => setPhase(event.target.value as AlmanacSetupPhase)}
                  className="w-full rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
                >
                  {PHASES.map((option) => (
                    <option key={option} value={option}>
                      {option.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-text-muted">Label</span>
              <select
                value={label}
                onChange={(event) => setLabel(event.target.value as AlmanacTradeLabel)}
                className="w-full rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
              >
                {LABELS.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-text-muted">Notes</span>
              <textarea
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-border-default bg-bg-elevated px-2 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>

            <Button type="button" className="w-full" disabled={busy || !ticker.trim() || !setupTag} onClick={saveReview}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Review
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-muted pb-2 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="text-right text-text-secondary">{value}</span>
    </div>
  )
}

function TagGroup({ label, tags }: { label: string; tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-text-muted">{label}</div>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px]">
            {tag.replaceAll('_', ' ')}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function labelTone(label: AlmanacTradeLabel) {
  if (label === 'VALID') return 'border-bullish/30 bg-bullish/10 text-bullish'
  if (label === 'FALSE_POSITIVE') return 'border-bearish/30 bg-bearish/10 text-bearish'
  if (label === 'REFERENCE_ONLY') return 'border-warning/30 bg-warning/10 text-warning'
  return 'border-border bg-bg-elevated text-text-secondary'
}

function shortLabel(label: AlmanacTradeLabel) {
  if (label === 'FALSE_POSITIVE') return 'FALSE'
  if (label === 'REFERENCE_ONLY') return 'REF'
  return label
}

function filterCases(cases: AlmanacTradeCase[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return cases
  return cases.filter((tradeCase) => {
    const haystack = [
      tradeCase.ticker,
      tradeCase.setupTag,
      tradeCase.direction ?? '',
      tradeCase.phase,
      tradeCase.label,
      tradeCase.sourceExcerpt ?? '',
      tradeCase.reviewNotes ?? '',
      tradeCase.report?.title ?? '',
      tradeCase.report?.marketContext ?? '',
      ...toStringArray(tradeCase.catalystTagsJson),
      ...toStringArray(tradeCase.mindsetTagsJson),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalized)
  })
}

function buildDirectoryTree(cases: AlmanacTradeCase[], grouping: GroupingPreset): DirectoryNode[] {
  const sorted = [...cases].sort((a, b) =>
    [
      timeKey(a).localeCompare(timeKey(b)),
      catalystKey(a).localeCompare(catalystKey(b)),
      a.setupTag.localeCompare(b.setupTag),
      a.ticker.localeCompare(b.ticker),
    ].find((value) => value !== 0) ?? 0,
  )

  if (grouping === 'time-catalyst-setup-stock') {
    return groupCases(sorted, ['time', 'catalyst'], (item) => ({
      label: `${formatSetup(item.setupTag)} - ${item.ticker}`,
      meta: caseMeta(item),
    }))
  }
  if (grouping === 'setup-time-stock') {
    return groupCases(sorted, ['setup', 'time'], (item) => ({
      label: `${item.ticker}`,
      meta: caseMeta(item),
    }))
  }
  if (grouping === 'stock-setup-time') {
    return groupCases(sorted, ['stock', 'setup'], (item) => ({
      label: `${reportLabel(item)} - ${formatSetup(item.setupTag)}`,
      meta: caseMeta(item),
    }))
  }
  return groupCases(sorted, ['catalyst', 'time'], (item) => ({
    label: `${formatSetup(item.setupTag)} - ${item.ticker}`,
    meta: caseMeta(item),
  }))
}

function groupCases(
  cases: AlmanacTradeCase[],
  dimensions: Array<'time' | 'catalyst' | 'setup' | 'stock'>,
  leaf: (tradeCase: AlmanacTradeCase) => { label: string; meta: string },
  path = '',
): DirectoryNode[] {
  if (dimensions.length === 0) {
    return cases.map((tradeCase) => {
      const label = leaf(tradeCase)
      return {
        id: `case:${tradeCase.id}`,
        type: 'case',
        tradeCase,
        label: label.label,
        meta: label.meta,
      }
    })
  }

  const [dimension, ...rest] = dimensions
  const groups = new Map<string, AlmanacTradeCase[]>()
  for (const tradeCase of cases) {
    const key = groupKey(tradeCase, dimension)
    groups.set(key, [...(groups.get(key) ?? []), tradeCase])
  }

  return Array.from(groups.entries()).map(([label, groupedCases]) => {
    const id = `${path}/${dimension}:${label}`
    return {
      id,
      type: 'folder',
      label,
      count: groupedCases.length,
      children: groupCases(groupedCases, rest, leaf, id),
    }
  })
}

function groupKey(tradeCase: AlmanacTradeCase, dimension: 'time' | 'catalyst' | 'setup' | 'stock') {
  if (dimension === 'time') return timeKey(tradeCase)
  if (dimension === 'catalyst') return catalystKey(tradeCase)
  if (dimension === 'setup') return formatSetup(tradeCase.setupTag)
  return tradeCase.ticker
}

function firstBranch(nodes: DirectoryNode[]) {
  const ids = new Set<string>()
  let current = nodes[0]
  while (current?.type === 'folder') {
    ids.add(current.id)
    current = current.children[0]
  }
  return ids
}

function sameSet(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false
  for (const item of left) {
    if (!right.has(item)) return false
  }
  return true
}

function timeKey(tradeCase: AlmanacTradeCase) {
  const date = tradeCase.report?.reportDate ?? tradeCase.timeframeStart
  if (!date) return 'Unknown time'
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const quarter = Math.max(1, Math.ceil(month / 3))
  return `${year} Q${quarter} / ${reportLabel(tradeCase)}`
}

function reportLabel(tradeCase: AlmanacTradeCase) {
  return tradeCase.report?.title ?? tradeCase.timeframeStart?.slice(0, 10) ?? 'Unknown date'
}

function catalystKey(tradeCase: AlmanacTradeCase) {
  return toStringArray(tradeCase.catalystTagsJson)[0]?.replaceAll('_', ' ') ?? 'No catalyst'
}

function caseMeta(tradeCase: AlmanacTradeCase) {
  return `${reportLabel(tradeCase)} / p. ${tradeCase.sourcePage} / ${tradeCase.phase.replaceAll('_', ' ')}`
}

function formatPeriod(tradeCase: AlmanacTradeCase) {
  const start = tradeCase.timeframeStart?.slice(0, 10)
  const end = tradeCase.timeframeEnd?.slice(0, 10)
  if (start && end && start !== end) return `${start} to ${end}`
  return end ?? start ?? tradeCase.report?.reportDate?.slice(0, 10) ?? '-'
}

function formatSetup(setup: string) {
  return setup.replaceAll('_', ' ')
}
