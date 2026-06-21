import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookMarked,
  CalendarDays,
  Database,
  FileText,
  Filter,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
  Tags,
  UploadCloud,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  fetchAlmanacExplorer,
  importAlmanacLibrary,
  reviewAlmanacTradeCase,
  type AlmanacDoctrine,
  type AlmanacExplorerResponse,
  type AlmanacFilters,
  type AlmanacTradeCase,
  type AlmanacTradeLabel,
} from '@/lib/api/research'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
  { id: 'stocks', label: 'Stocks', icon: Database },
  { id: 'setups', label: 'Setups', icon: Layers3 },
  { id: 'catalysts', label: 'Catalysts', icon: Tags },
  { id: 'mindset', label: 'Mindset', icon: BookMarked },
] as const

const LABELS: AlmanacTradeLabel[] = ['UNCLEAR', 'VALID', 'REFERENCE_ONLY', 'FALSE_POSITIVE']
const YEARS = [2020, 2022]
const QUARTERS = [1, 2, 3, 4]
const PAGE_SIZE = 24

type AlmanacTab = (typeof TABS)[number]['id']

export default function Almanac() {
  const [payload, setPayload] = useState<AlmanacExplorerResponse | null>(null)
  const [activeTab, setActiveTab] = useState<AlmanacTab>('timeline')
  const [filters, setFilters] = useState<AlmanacFilters>({ page: 1, limit: PAGE_SIZE })
  const [queryDraft, setQueryDraft] = useState('')
  const [selectedCaseId, setSelectedCaseId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const selectedCase = useMemo(
    () => payload?.tradeCases.find((item) => item.id === selectedCaseId) ?? payload?.tradeCases[0] ?? null,
    [payload?.tradeCases, selectedCaseId],
  )

  const filteredDoctrines = useMemo(() => {
    const doctrines = payload?.doctrines ?? []
    if (activeTab === 'mindset') return doctrines
    if (activeTab === 'setups' && filters.setupTag) {
      return doctrines.filter((item) => toStringArray(item.setupTagsJson).includes(filters.setupTag ?? ''))
    }
    return doctrines.slice(0, 8)
  }, [activeTab, filters.setupTag, payload?.doctrines])

  const updateFilter = (patch: Partial<AlmanacFilters>) => {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1, limit: PAGE_SIZE }))
    setSelectedCaseId('')
  }

  const handleImport = async () => {
    setBusy('import')
    setError(null)
    try {
      await importAlmanacLibrary({ extractImages: false })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Almanac import')
    } finally {
      setBusy(null)
    }
  }

  const handleLabel = async (tradeCase: AlmanacTradeCase, label: AlmanacTradeLabel) => {
    setBusy(tradeCase.id)
    setError(null)
    try {
      await reviewAlmanacTradeCase(tradeCase.id, { label })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update label')
    } finally {
      setBusy(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil((payload?.total ?? 0) / PAGE_SIZE))

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <BookMarked className="h-6 w-6 text-accent" />
            <h1 className="font-heading text-2xl font-bold tracking-tight text-text-primary lg:text-3xl">
              Gilmo Almanac
            </h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            Private setup doctrine, trade cases, and chart evidence extracted from the Almanac PDFs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => void handleImport()}
            disabled={busy === 'import'}
          >
            {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Index PDFs
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-bearish/30 bg-bearish/10 px-3 py-2 text-sm text-bearish">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-5">
        <Metric label="Sources" value={payload?.summary.sourceCount ?? 0} />
        <Metric label="Reports" value={payload?.summary.reportCount ?? 0} />
        <Metric label="Charts" value={payload?.summary.chartCount ?? 0} />
        <Metric label="Trade cases" value={payload?.summary.tradeCaseCount ?? 0} />
        <Metric label="Doctrine" value={payload?.summary.doctrineCount ?? 0} />
      </section>

      <nav className="flex gap-1 overflow-x-auto border-b border-border-default">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="space-y-3 rounded-md border border-border-default bg-bg-surface p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Filter className="h-4 w-4 text-accent" />
            Filters
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              updateFilter({ q: queryDraft.trim() || undefined })
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs text-text-muted">Search</span>
              <div className="flex items-center gap-2 rounded-md border border-border-default bg-bg-elevated px-2">
                <Search className="h-4 w-4 text-text-muted" />
                <input
                  value={queryDraft}
                  onChange={(event) => setQueryDraft(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none"
                  placeholder="ticker, setup, note"
                />
              </div>
            </label>
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
          </form>

          <FacetBlock title="Catalysts" items={payload?.facets.catalystTags ?? []} active={filters.catalystTag} onPick={(value) => updateFilter({ catalystTag: filters.catalystTag === value ? undefined : value })} />
          <FacetBlock title="Mindset" items={payload?.facets.mindsetTags ?? []} active={filters.mindsetTag} onPick={(value) => updateFilter({ mindsetTag: filters.mindsetTag === value ? undefined : value })} />
        </aside>

        <main className="min-w-0 space-y-4">
          {activeTab === 'timeline' ? <Timeline reports={payload?.reports ?? []} /> : null}
          {activeTab === 'mindset' ? <DoctrineList doctrines={filteredDoctrines} /> : null}
          {activeTab !== 'timeline' && activeTab !== 'mindset' ? (
            <DoctrineList doctrines={filteredDoctrines} compact />
          ) : null}

          <div className="rounded-md border border-border-default bg-bg-surface">
            <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Trade Cases</h2>
                <p className="text-xs text-text-muted">{payload?.total ?? 0} matching candidates</p>
              </div>
              <Pagination
                page={filters.page ?? 1}
                totalPages={totalPages}
                onPage={(page) => updateFilter({ page })}
              />
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center text-sm text-text-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Almanac index
              </div>
            ) : (payload?.tradeCases.length ?? 0) === 0 ? (
              <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-text-muted">
                No cases yet. Start the PDF indexer, then refresh this page.
              </div>
            ) : (
              <div className="divide-y divide-border-muted">
                {payload?.tradeCases.map((tradeCase) => (
                  <TradeCaseRow
                    key={tradeCase.id}
                    tradeCase={tradeCase}
                    active={tradeCase.id === selectedCase?.id}
                    busy={busy === tradeCase.id}
                    onSelect={() => setSelectedCaseId(tradeCase.id)}
                    onLabel={(label) => void handleLabel(tradeCase, label)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        <EvidencePanel tradeCase={selectedCase} />
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-default bg-bg-surface px-3 py-2">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 font-heading text-xl font-semibold text-text-primary">{value.toLocaleString()}</div>
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

function FacetBlock({
  title,
  items,
  active,
  onPick,
}: {
  title: string
  items: string[]
  active?: string
  onPick: (value: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-text-muted">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className={cn(
              'rounded border px-2 py-1 text-[11px] transition-colors',
              active === item
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border-muted bg-bg-elevated text-text-secondary hover:text-text-primary',
            )}
          >
            {item.replaceAll('_', ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}

function TradeCaseRow({
  tradeCase,
  active,
  busy,
  onSelect,
  onLabel,
}: {
  tradeCase: AlmanacTradeCase
  active: boolean
  busy: boolean
  onSelect: () => void
  onLabel: (label: AlmanacTradeLabel) => void
}) {
  return (
    <div
      className={cn(
        'grid gap-3 px-3 py-3 transition-colors lg:grid-cols-[1fr_auto]',
        active ? 'bg-accent/8' : 'hover:bg-bg-elevated',
      )}
    >
      <button type="button" className="min-w-0 text-left" onClick={onSelect}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-base font-semibold text-text-primary">{tradeCase.ticker}</span>
          <Badge className={labelTone(tradeCase.label)}>{tradeCase.label.replaceAll('_', ' ')}</Badge>
          {tradeCase.direction ? <Badge variant="outline">{tradeCase.direction}</Badge> : null}
          <Badge variant="outline">{tradeCase.phase.replaceAll('_', ' ')}</Badge>
        </div>
        <div className="mt-1 text-sm text-text-secondary">{tradeCase.setupTag.replaceAll('_', ' ')}</div>
        <p className="mt-1 line-clamp-2 text-xs text-text-muted">{tradeCase.sourceExcerpt}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-muted">
          <span>{tradeCase.report?.title ?? 'Report date unknown'}</span>
          <span>Page {tradeCase.sourcePage}</span>
          <span>{tradeCase.source.pdfFileName}</span>
        </div>
      </button>
      <div className="flex flex-wrap items-start gap-1 lg:justify-end">
        {LABELS.map((label) => (
          <button
            key={label}
            type="button"
            disabled={busy}
            onClick={() => onLabel(label)}
            className={cn(
              'rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-50',
              tradeCase.label === label
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border-muted text-text-secondary hover:text-text-primary',
            )}
          >
            {label === 'FALSE_POSITIVE' ? 'False' : label.replaceAll('_', ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}

function EvidencePanel({ tradeCase }: { tradeCase: AlmanacTradeCase | null }) {
  if (!tradeCase) {
    return (
      <aside className="rounded-md border border-border-default bg-bg-surface p-4 text-sm text-text-muted">
        Select a trade case to inspect evidence.
      </aside>
    )
  }

  const setupTags = toStringArray(tradeCase.chart?.inferredSetupTags)
  const catalystTags = toStringArray(tradeCase.catalystTagsJson)
  const mindsetTags = toStringArray(tradeCase.mindsetTagsJson)
  const imageUrl = assetUrl(tradeCase.chart?.imagePath)

  return (
    <aside className="space-y-3 rounded-md border border-border-default bg-bg-surface p-4">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Evidence</h2>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {tradeCase.source.title ?? tradeCase.source.pdfFileName}
        </p>
      </div>

      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${tradeCase.ticker} Almanac chart`}
          className="max-h-64 w-full rounded border border-border-muted object-contain"
        />
      ) : (
        <div className="flex h-36 items-center justify-center rounded border border-dashed border-border-default text-center text-xs text-text-muted">
          Chart image path will appear after extraction is enabled.
        </div>
      )}

      <InfoRow label="Ticker" value={tradeCase.ticker} />
      <InfoRow label="Setup" value={tradeCase.setupTag.replaceAll('_', ' ')} />
      <InfoRow label="Report" value={tradeCase.report?.title ?? '-'} />
      <InfoRow label="Source page" value={String(tradeCase.sourcePage)} />
      <InfoRow label="Confidence" value={tradeCase.sourceConfidence} />

      <TagGroup label="Chart tags" tags={setupTags} />
      <TagGroup label="Catalysts" tags={catalystTags} />
      <TagGroup label="Mindset" tags={mindsetTags} />

      {tradeCase.sourceExcerpt ? (
        <div>
          <div className="mb-1 text-xs font-medium text-text-muted">Short excerpt</div>
          <p className="rounded border border-border-muted bg-bg-elevated p-2 text-xs leading-relaxed text-text-secondary">
            {tradeCase.sourceExcerpt}
          </p>
        </div>
      ) : null}
    </aside>
  )
}

function Timeline({ reports }: { reports: AlmanacExplorerResponse['reports'] }) {
  if (reports.length === 0) return null
  return (
    <section className="rounded-md border border-border-default bg-bg-surface">
      <div className="border-b border-border-default px-3 py-2 text-sm font-semibold text-text-primary">
        Report Timeline
      </div>
      <div className="grid gap-0 divide-y divide-border-muted">
        {reports.slice(0, 8).map((report) => (
          <div key={report.id} className="grid gap-2 px-3 py-3 md:grid-cols-[140px_1fr_auto]">
            <div className="text-sm font-medium text-text-primary">{report.title}</div>
            <div className="text-xs text-text-secondary">{report.marketContext}</div>
            <div className="text-xs text-text-muted">
              p. {report.pageStart}-{report.pageEnd} / {report._count?.tradeCases ?? 0} cases
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function DoctrineList({
  doctrines,
  compact = false,
}: {
  doctrines: AlmanacDoctrine[]
  compact?: boolean
}) {
  if (doctrines.length === 0) return null
  return (
    <section className="grid gap-2 md:grid-cols-2">
      {doctrines.slice(0, compact ? 4 : 8).map((doctrine) => (
        <article key={doctrine.id} className="rounded-md border border-border-default bg-bg-surface p-3">
          <h3 className="text-sm font-semibold text-text-primary">{doctrine.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{doctrine.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {toStringArray(doctrine.setupTagsJson).slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag.replaceAll('_', ' ')}
              </Badge>
            ))}
          </div>
        </article>
      ))}
    </section>
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

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded border border-border-muted px-2 py-1 text-text-secondary disabled:opacity-40"
      >
        Prev
      </button>
      <span className="text-text-muted">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="rounded border border-border-muted px-2 py-1 text-text-secondary disabled:opacity-40"
      >
        Next
      </button>
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

function assetUrl(path: string | null | undefined) {
  if (!path) return null
  const relative = path.replace(/^artifacts\/almanac\//, '')
  return `/api/research/almanac/assets/${relative}`
}
