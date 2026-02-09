import { useEffect, useState, useCallback } from 'react'
import { Layers, ChevronRight, ChevronDown } from 'lucide-react'
import { useThemeStore } from '@/stores/useThemeStore'
import { useSetupStore } from '@/stores/useSetupStore'
import { computeThemeDirection } from '@/types'
import type { ThemeDirection } from '@/types'
import { LoadingSkeleton, SkeletonGroup } from '@/components/shared'
import { ThemeStockList } from '@/components/ThemeStockList'
import { cn } from '@/lib/utils'

type DirectionFilter = 'ALL' | ThemeDirection

const DIRECTION_FILTERS: { value: DirectionFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'BULLISH', label: 'Bullish' },
  { value: 'BEARISH', label: 'Bearish' },
  { value: 'NEUTRAL', label: 'Neutral' },
]

export default function ThemeExplorer() {
  const themes = useThemeStore((s) => s.themes)
  const themeDetails = useThemeStore((s) => s.themeDetails)
  const detailLoading = useThemeStore((s) => s.detailLoading)
  const loading = useThemeStore((s) => s.loading)
  const error = useThemeStore((s) => s.error)
  const fetchThemes = useThemeStore((s) => s.fetchThemes)
  const fetchThemeDetail = useThemeStore((s) => s.fetchThemeDetail)
  const fetchDailySetups = useSetupStore((s) => s.fetchDailySetups)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL')

  useEffect(() => {
    fetchThemes()
    fetchDailySetups()
  }, [fetchThemes, fetchDailySetups])

  const handleToggleExpand = useCallback(
    (id: string) => {
      setExpandedId((prev) => {
        if (prev === id) return null
        // Fetch detail if not cached
        fetchThemeDetail(id)
        return id
      })
    },
    [fetchThemeDetail],
  )

  // Compute direction for each theme and filter
  const filteredThemes = themes
    .map((theme) => ({
      ...theme,
      direction: computeThemeDirection(theme.stats.bullishPct, theme.stats.bearishPct),
    }))
    .filter((t) => directionFilter === 'ALL' || t.direction === directionFilter)
    // Sort: one-sided first, then by setup count
    .toSorted((a, b) => {
      const aOneSided = a.direction !== 'NEUTRAL' ? 1 : 0
      const bOneSided = b.direction !== 'NEUTRAL' ? 1 : 0
      if (bOneSided !== aOneSided) return bOneSided - aOneSided
      return b.stats.setupCount - a.stats.setupCount
    })

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <Layers className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
        <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
          Theme Explorer
        </h1>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary sm:text-sm">
          Themes with one-sided setups. Click to explore stocks in each group.
        </p>

        {/* Direction filter pills */}
        <div className="flex gap-1">
          {DIRECTION_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setDirectionFilter(f.value)}
              className={cn(
                'cursor-pointer rounded-md px-2 py-1 text-[10px] font-medium transition-colors sm:px-3 sm:text-xs',
                directionFilter === f.value
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:bg-bg-elevated hover:text-text-secondary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <SkeletonGroup count={5}>
          <LoadingSkeleton className="h-16 rounded-xl sm:h-20" />
        </SkeletonGroup>
      ) : error ? (
        <div className="rounded-xl border border-bearish/30 bg-bearish/5 p-4 text-sm text-bearish">
          Failed to load themes: {error}
        </div>
      ) : filteredThemes.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-text-muted">
          No themes found
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredThemes.map((theme) => {
            const isExpanded = expandedId === theme.id
            const detail = themeDetails[theme.id]
            const isDetailLoading = detailLoading[theme.id]

            return (
              <div
                key={theme.id}
                className="overflow-hidden rounded-xl border border-border-default bg-bg-surface transition-colors hover:border-border-accent/30"
              >
                {/* Theme row header */}
                <button
                  onClick={() => handleToggleExpand(theme.id)}
                  className="flex w-full cursor-pointer items-center justify-between p-4 text-left sm:p-5"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5',
                        theme.direction === 'BULLISH' && 'bg-bullish',
                        theme.direction === 'BEARISH' && 'bg-bearish',
                        theme.direction === 'NEUTRAL' && 'bg-text-muted',
                      )}
                    />
                    <div>
                      <h3 className="font-heading text-sm font-semibold text-text-primary sm:text-base lg:text-lg">
                        {theme.name}
                      </h3>
                      <p className="text-[10px] text-text-secondary sm:text-xs">
                        {theme.stats.setupCount} setups &middot;{' '}
                        {theme.stats.hotCount} hot &middot;{' '}
                        S2: {(theme.stats.stageDistribution.stage2 * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Bullish/Bearish percentage */}
                    <div className="hidden items-center gap-1.5 sm:flex">
                      <span className="font-mono text-[10px] text-bullish">
                        {theme.stats.bullishPct.toFixed(0)}%
                      </span>
                      <span className="text-[10px] text-text-muted">/</span>
                      <span className="font-mono text-[10px] text-bearish">
                        {theme.stats.bearishPct.toFixed(0)}%
                      </span>
                    </div>

                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:py-1 sm:text-xs',
                        theme.direction === 'BULLISH' && 'bg-bullish-muted text-bullish',
                        theme.direction === 'BEARISH' && 'bg-bearish-muted text-bearish',
                        theme.direction === 'NEUTRAL' && 'bg-bg-elevated text-text-muted',
                      )}
                    >
                      {theme.direction}
                    </span>

                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-text-muted sm:h-5 sm:w-5" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-text-muted transition-transform sm:h-5 sm:w-5" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded ? (
                  <div className="border-t border-border-muted px-4 py-3 sm:px-5 sm:py-4">
                    {isDetailLoading ? (
                      <SkeletonGroup count={3}>
                        <LoadingSkeleton className="h-10 rounded-lg" />
                      </SkeletonGroup>
                    ) : detail ? (
                      <ThemeStockList detail={detail} />
                    ) : (
                      <div className="py-4 text-center text-xs text-text-muted">
                        No data available
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
