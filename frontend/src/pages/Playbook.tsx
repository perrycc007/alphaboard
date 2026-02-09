import { useEffect, useState, useCallback } from 'react'
import { Trophy, Filter, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLeaderStore } from '@/stores/useLeaderStore'
import { useSlidePanelStore } from '@/stores/useSlidePanelStore'
import { LoadingSkeleton, SkeletonGroup } from '@/components/shared'
import { cn, formatPrice } from '@/lib/utils'

const GAIN_OPTIONS = [
  { value: 30, label: '30%+' },
  { value: 50, label: '50%+' },
  { value: 100, label: '100%+' },
  { value: 200, label: '200%+' },
]

const PERIOD_OPTIONS = [
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
]

export default function Playbook() {
  const leaders = useLeaderStore((s) => s.leaders)
  const total = useLeaderStore((s) => s.total)
  const page = useLeaderStore((s) => s.page)
  const limit = useLeaderStore((s) => s.limit)
  const loading = useLeaderStore((s) => s.loading)
  const error = useLeaderStore((s) => s.error)
  const fetchLeaders = useLeaderStore((s) => s.fetchLeaders)
  const setStorePage = useLeaderStore((s) => s.setPage)
  const openPanel = useSlidePanelStore((s) => s.openPanel)

  const [minGain, setMinGain] = useState(50)
  const [days, setDays] = useState(365)
  const [showFilters, setShowFilters] = useState(false)

  const totalPages = Math.ceil(total / limit)

  useEffect(() => {
    fetchLeaders({ minGain, days, page: 1 })
  }, [fetchLeaders, minGain, days])

  const handleTickerClick = useCallback(
    (ticker: string) => openPanel(ticker),
    [openPanel],
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Trophy className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            Playbook
          </h1>
          {total > 0 ? (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent sm:text-xs">
              {total}
            </span>
          ) : null}
        </div>
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-ring sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
        >
          <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Filter
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform',
              showFilters && 'rotate-180',
            )}
          />
        </button>
      </div>

      <p className="text-xs text-text-secondary sm:text-sm">
        Past leaders and what the system would have suggested. Click to review annotated charts with entry/exit points.
      </p>

      {/* Filters */}
      {showFilters ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-default bg-bg-surface p-3 sm:gap-4 sm:p-4">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-text-muted sm:text-xs">Min Gain</label>
            <div className="flex gap-1">
              {GAIN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMinGain(opt.value)}
                  className={cn(
                    'cursor-pointer rounded-md px-2 py-1 text-[10px] font-medium transition-colors sm:px-3 sm:text-xs',
                    minGain === opt.value
                      ? 'bg-accent/15 text-accent'
                      : 'bg-bg-elevated text-text-muted hover:text-text-secondary',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-text-muted sm:text-xs">Period</label>
            <div className="flex gap-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={cn(
                    'cursor-pointer rounded-md px-2 py-1 text-[10px] font-medium transition-colors sm:px-3 sm:text-xs',
                    days === opt.value
                      ? 'bg-accent/15 text-accent'
                      : 'bg-bg-elevated text-text-muted hover:text-text-secondary',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Leader list */}
      {loading ? (
        <SkeletonGroup count={5}>
          <LoadingSkeleton className="h-16 rounded-xl sm:h-20" />
        </SkeletonGroup>
      ) : error ? (
        <div className="rounded-xl border border-bearish/30 bg-bearish/5 p-4 text-sm text-bearish">
          Failed to load leaders: {error}
        </div>
      ) : leaders.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-text-muted">
          No leaders found with the current filters
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {leaders.map((leader) => (
            <button
              key={`${leader.ticker}-${leader.entryDate}`}
              onClick={() => handleTickerClick(leader.ticker)}
              className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-border-default bg-bg-surface p-4 text-left transition-colors hover:border-border-accent/30 sm:p-5"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Mini gain bar */}
                <div className="flex h-10 w-16 flex-col items-center justify-center rounded border border-bullish/20 bg-bullish/5 sm:h-12 sm:w-20">
                  <span className="font-mono text-xs font-bold text-bullish sm:text-sm">
                    +{leader.peakGain}%
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-bold text-text-primary sm:text-base">
                      {leader.ticker}
                    </span>
                    {leader.theme ? (
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent sm:text-xs">
                        {leader.theme}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-text-secondary sm:text-xs">
                    {leader.name} &middot; {leader.entryDate.slice(0, 10)} &middot; {leader.duration} days
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs text-text-secondary sm:text-sm">
                  ${formatPrice(leader.entryPrice)} &rarr; ${formatPrice(leader.peakPrice)}
                </div>
                <div className="text-[10px] text-text-muted sm:text-xs">entry &rarr; peak</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-border-default bg-bg-surface px-4 py-3 sm:px-5">
          <span className="text-xs text-text-muted sm:text-sm">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setStorePage(page - 1)}
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
                  onClick={() => setStorePage(pageNum)}
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
              onClick={() => setStorePage(page + 1)}
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
