import { useEffect } from 'react'
import { LayoutDashboard, Layers, TrendingUp, Eye, Zap, BarChart3, Activity, ChevronRight } from 'lucide-react'
import { useMarketStore } from '@/stores/useMarketStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { useTradeStore } from '@/stores/useTradeStore'
import { useSetupStore } from '@/stores/useSetupStore'
import { useSlidePanelStore } from '@/stores/useSlidePanelStore'
import { computeThemeDirection } from '@/types'
import type { ApiTheme, ApiPosition, ApiSetup } from '@/types'
import { IndexMiniCard } from '@/components/IndexMiniCard'
import { BreadthSummaryBar } from '@/components/BreadthSummaryBar'
import { SetupTypeBadge, DirectionBadge, StageTag, LoadingSkeleton, SkeletonGroup } from '@/components/shared'
import { cn, formatPrice, formatPercent, formatRMultiple, formatCompactNumber } from '@/lib/utils'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { overview, loading: marketLoading, fetchOverview } = useMarketStore()
  const { themes, loading: themesLoading, fetchThemes } = useThemeStore()
  const { positions, loading: positionsLoading, fetchPositions } = useTradeStore()
  const { dailySetups, loading: setupsLoading, fetchDailySetups } = useSetupStore()
  const openPanel = useSlidePanelStore((s) => s.openPanel)

  // Fetch all dashboard data in parallel on mount
  useEffect(() => {
    fetchOverview()
    fetchThemes()
    fetchPositions()
    fetchDailySetups()
  }, [fetchOverview, fetchThemes, fetchPositions, fetchDailySetups])

  // Filter to one-sided themes, take top 5
  const suggestedThemes = themes
    .map((t) => ({ ...t, direction: computeThemeDirection(t.stats.bullishPct, t.stats.bearishPct) }))
    .filter((t) => t.direction !== 'NEUTRAL')
    .toSorted((a, b) => b.stats.setupCount - a.stats.setupCount)
    .slice(0, 5)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <LayoutDashboard className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
        <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
          Dashboard
        </h1>
      </div>

      {/* Bento grid */}
      <div className="grid auto-rows-min grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5">
        {/* ---- Market Breadth (full width) ---- */}
        <div className="col-span-full rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5 lg:p-6">
          <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 sm:h-8 sm:w-8">
              <Activity className="h-3.5 w-3.5 text-accent sm:h-4 sm:w-4" />
            </div>
            <h2 className="font-heading text-sm font-semibold text-text-primary sm:text-base">
              Market Breadth
            </h2>
          </div>

          {marketLoading ? (
            <SkeletonGroup count={3}>
              <LoadingSkeleton className="h-16 rounded-lg" />
            </SkeletonGroup>
          ) : overview ? (
            <div className="space-y-3">
              {/* Index cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {overview.indices.map((idx) => (
                  <IndexMiniCard key={idx.ticker} index={idx} />
                ))}
              </div>
              {/* Breadth gauges */}
              <BreadthSummaryBar breadth={overview.breadth} />
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center text-xs text-text-muted">
              No market data available
            </div>
          )}
        </div>

        {/* ---- Suggested Themes (2 cols) ---- */}
        <div className="col-span-full rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5 lg:col-span-2 lg:p-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 sm:h-8 sm:w-8">
                <Layers className="h-3.5 w-3.5 text-accent sm:h-4 sm:w-4" />
              </div>
              <h2 className="font-heading text-sm font-semibold text-text-primary sm:text-base">
                Suggested Themes
              </h2>
            </div>
            <Link
              to="/themes"
              className="flex items-center gap-1 text-[10px] text-accent hover:underline sm:text-xs"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {themesLoading ? (
            <SkeletonGroup count={3}>
              <LoadingSkeleton className="h-14 rounded-lg" />
            </SkeletonGroup>
          ) : suggestedThemes.length > 0 ? (
            <div className="space-y-2">
              {suggestedThemes.map((theme) => (
                <Link
                  key={theme.id}
                  to="/themes"
                  className="flex items-center justify-between rounded-lg bg-bg-elevated p-2.5 transition-colors hover:bg-bg-hover sm:p-3"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        theme.direction === 'BULLISH' ? 'bg-bullish' : 'bg-bearish',
                      )}
                    />
                    <span className="text-xs font-medium text-text-primary sm:text-sm">
                      {theme.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-text-muted sm:text-xs">
                      {theme.stats.setupCount} setups
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        theme.direction === 'BULLISH'
                          ? 'bg-bullish-muted text-bullish'
                          : 'bg-bearish-muted text-bearish',
                      )}
                    >
                      {theme.direction}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center text-xs text-text-muted">
              No one-sided themes detected
            </div>
          )}
        </div>

        {/* ---- Active Setups (1 col) ---- */}
        <div className="col-span-full rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5 lg:col-span-1 lg:p-6">
          <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 sm:h-8 sm:w-8">
              <Zap className="h-3.5 w-3.5 text-accent sm:h-4 sm:w-4" />
            </div>
            <h2 className="font-heading text-sm font-semibold text-text-primary sm:text-base">
              Daily Setups
            </h2>
            {dailySetups.length > 0 ? (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {dailySetups.length}
              </span>
            ) : null}
          </div>

          {setupsLoading ? (
            <SkeletonGroup count={4}>
              <LoadingSkeleton className="h-10 rounded-lg" />
            </SkeletonGroup>
          ) : dailySetups.length > 0 ? (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {dailySetups.slice(0, 10).map((setup) => (
                <button
                  key={setup.id}
                  onClick={() => openPanel(setup.stock.ticker)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg bg-bg-elevated px-2.5 py-2 text-left transition-colors hover:bg-bg-hover"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-12 font-heading text-xs font-bold text-text-primary">
                      {setup.stock.ticker}
                    </span>
                    <SetupTypeBadge type={setup.type} />
                  </div>
                  <DirectionBadge direction={setup.direction} />
                </button>
              ))}
              {dailySetups.length > 10 ? (
                <div className="pt-1 text-center text-[10px] text-text-muted">
                  +{dailySetups.length - 10} more setups
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center text-xs text-text-muted">
              No active daily setups
            </div>
          )}
        </div>

        {/* ---- Open Positions (1 col) ---- */}
        <div className="col-span-full rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5 lg:col-span-1 lg:p-6">
          <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 sm:h-8 sm:w-8">
              <TrendingUp className="h-3.5 w-3.5 text-accent sm:h-4 sm:w-4" />
            </div>
            <h2 className="font-heading text-sm font-semibold text-text-primary sm:text-base">
              Open Positions
            </h2>
          </div>

          {positionsLoading ? (
            <SkeletonGroup count={3}>
              <LoadingSkeleton className="h-12 rounded-lg" />
            </SkeletonGroup>
          ) : positions.length > 0 ? (
            <div className="space-y-1.5">
              {positions.map((pos) => (
                <PositionChip key={pos.id} position={pos} onSelect={openPanel} />
              ))}
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center text-xs text-text-muted">
              No open positions
            </div>
          )}
        </div>

        {/* ---- System Performance (1 col, placeholder) ---- */}
        <div className="col-span-full rounded-xl border border-border-default bg-bg-surface p-4 sm:p-5 lg:col-span-1 lg:p-6">
          <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 sm:h-8 sm:w-8">
              <BarChart3 className="h-3.5 w-3.5 text-accent sm:h-4 sm:w-4" />
            </div>
            <h2 className="font-heading text-sm font-semibold text-text-primary sm:text-base">
              System Performance
            </h2>
          </div>
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border-muted sm:h-36">
            <span className="text-xs text-text-muted sm:text-sm">Paper trade stats coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Sub-components ----

function PositionChip({
  position,
  onSelect,
}: {
  position: ApiPosition
  onSelect: (ticker: string) => void
}) {
  const isProfit = position.unrealizedPnl >= 0

  return (
    <button
      onClick={() => onSelect(position.ticker)}
      className="flex w-full cursor-pointer items-center justify-between rounded-lg bg-bg-elevated px-3 py-2 text-left transition-colors hover:bg-bg-hover sm:px-4 sm:py-2.5"
    >
      <div className="flex items-center gap-2">
        <span className="font-heading text-xs font-bold text-text-primary sm:text-sm">
          {position.ticker}
        </span>
        <DirectionBadge direction={position.direction} />
        <span className="font-mono text-[10px] text-text-muted sm:text-xs">
          {position.quantity} shares
        </span>
      </div>
      <div className="text-right">
        <div
          className={cn(
            'font-mono text-xs font-bold sm:text-sm',
            isProfit ? 'text-bullish' : 'text-bearish',
          )}
        >
          {isProfit ? '+' : ''}{formatPrice(position.unrealizedPnl)}
        </div>
      </div>
    </button>
  )
}
