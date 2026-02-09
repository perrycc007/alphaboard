import { useEffect, useState, useCallback } from 'react'
import { Search, Filter, TrendingUp, History, Gem, Flag, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchScreenedStocks } from '@/lib/api/stocks'
import { useSlidePanelStore } from '@/stores/useSlidePanelStore'
import { LoadingSkeleton, SkeletonGroup, StageTag, CategoryTag } from '@/components/shared'
import { cn, formatPrice } from '@/lib/utils'
import type { ApiStock, StageEnum, StockCategory } from '@/types'

interface ScreenedStock {
  stock: ApiStock
  stage: StageEnum
  category: StockCategory
  isTemplate: boolean
  latestBar: {
    close: number
    rsRank: number | null
    volume: number
  } | null
}

const PAGE_SIZE = 50

type TabId = 'stage2' | 'leaders' | 'commodity' | 'htf'

const TABS: { id: TabId; label: string; icon: typeof TrendingUp }[] = [
  { id: 'stage2', label: 'Stage 2', icon: TrendingUp },
  { id: 'leaders', label: 'Previous Leaders', icon: History },
  { id: 'commodity', label: 'Commodity', icon: Gem },
  { id: 'htf', label: 'High Tight Flag', icon: Flag },
]

function getFiltersForTab(tab: TabId): { stage?: string; category?: string } {
  switch (tab) {
    case 'stage2':
      return { stage: 'STAGE_2' }
    case 'leaders':
      return { category: 'FORMER_HOT' }
    case 'commodity':
      return { category: 'COMMODITY' }
    case 'htf':
      // HTF: Stage 2 stocks that are templates (high RS rank as proxy)
      return { stage: 'STAGE_2' }
    default:
      return {}
  }
}

export default function Screener() {
  const [activeTab, setActiveTab] = useState<TabId>('stage2')
  const [stocks, setStocks] = useState<ScreenedStock[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const openPanel = useSlidePanelStore((s) => s.openPanel)

  const fetchData = useCallback(async (tab: TabId, pg: number) => {
    setLoading(true)
    setError(null)
    try {
      const filters = getFiltersForTab(tab)
      const result = await fetchScreenedStocks({ ...filters, page: pg, limit: PAGE_SIZE })
      setStocks(result.items as unknown as ScreenedStock[])
      setTotal(result.total)
    } catch (err) {
      setError((err as Error).message)
      setStocks([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchData(activeTab, 1)
  }, [activeTab, fetchData])

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage)
      fetchData(activeTab, newPage)
    },
    [activeTab, fetchData],
  )

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const filtered = searchQuery
    ? stocks.filter(
        (s) =>
          s.stock.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.stock.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : stocks

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Filter className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            Stock Screener
          </h1>
          {total > 0 && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent sm:text-xs">
              {total}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-text-secondary sm:text-sm">
        Screen stocks by stage classification, category, and pattern criteria.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border-default bg-bg-surface p-1 sm:gap-2 sm:p-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-xs',
                activeTab === tab.id
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary',
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search by ticker or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border-default bg-bg-surface py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 sm:py-3"
        />
      </div>

      {/* Stock list */}
      {loading ? (
        <SkeletonGroup count={8}>
          <LoadingSkeleton className="h-14 rounded-xl sm:h-16" />
        </SkeletonGroup>
      ) : error ? (
        <div className="rounded-xl border border-bearish/30 bg-bearish/5 p-4 text-sm text-bearish">
          Failed to load stocks: {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-text-muted">
          No stocks found for the current criteria
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-default">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 border-b border-border-default bg-bg-elevated px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-text-muted sm:grid-cols-[1fr_100px_100px_100px_100px] sm:px-5 sm:text-xs">
            <span>Stock</span>
            <span className="text-right">Price</span>
            <span className="text-right">RS Rank</span>
            <span className="text-center">Stage</span>
            <span className="text-center">Category</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border-default">
            {filtered.map((item) => (
              <button
                key={item.stock.id}
                onClick={() => openPanel(item.stock.ticker)}
                className="group grid w-full cursor-pointer grid-cols-[1fr_80px_80px_80px_80px] items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-bg-hover sm:grid-cols-[1fr_100px_100px_100px_100px] sm:px-5 sm:py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-bold text-text-primary sm:text-base">
                      {item.stock.ticker}
                    </span>
                  </div>
                  <p className="truncate text-[10px] text-text-secondary sm:text-xs">
                    {item.stock.name}
                    {item.stock.sector ? ` \u00b7 ${item.stock.sector}` : ''}
                  </p>
                </div>
                <span className="text-right font-mono text-xs text-text-primary sm:text-sm">
                  {item.latestBar ? `$${formatPrice(Number(item.latestBar.close))}` : '--'}
                </span>
                <span className="text-right font-mono text-xs text-text-secondary sm:text-sm">
                  {item.latestBar?.rsRank != null
                    ? `${Number(item.latestBar.rsRank).toFixed(0)}`
                    : '--'}
                </span>
                <div className="flex justify-center">
                  <StageTag stage={item.stage} />
                </div>
                <div className="flex justify-center">
                  <CategoryTag category={item.category} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-border-default bg-bg-surface px-4 py-3 sm:px-5">
          <span className="text-xs text-text-muted sm:text-sm">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className={cn(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9',
                page <= 1
                  ? 'cursor-not-allowed text-text-muted/40'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={cn(
                    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition-colors sm:h-9 sm:w-9 sm:text-sm',
                    pageNum === page
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className={cn(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9',
                page >= totalPages
                  ? 'cursor-not-allowed text-text-muted/40'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
