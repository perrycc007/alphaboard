import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { LoadingSkeleton } from '@/components/shared'
import { formatPrice } from '@/lib/utils'
import type { ApiStockDaily, ApiSetup } from '@/types'

const LazyStockChartInner = lazy(() => import('./StockChartInner'))

const PRELOAD_ROOT_MARGIN = '240px 0px'

export interface StockChartProps {
  dailyBars: ApiStockDaily[]
  spyBars?: ApiStockDaily[]
  setups?: ApiSetup[]
  height?: number
  showMAs?: boolean
  showSpy?: boolean
  /** When true, draw entry/exit markers instead of horizontal price lines (for simulation) */
  showMarkers?: boolean
  /** Load immediately instead of waiting for the chart to enter the viewport. */
  priority?: boolean
}

function latestBarByDate(dailyBars: ApiStockDaily[]) {
  return dailyBars.reduce((latest, current) => (current.date > latest.date ? current : latest), dailyBars[0])
}

function earliestBarByDate(dailyBars: ApiStockDaily[]) {
  return dailyBars.reduce((earliest, current) => (current.date < earliest.date ? current : earliest), dailyBars[0])
}

function ChartPlaceholder({
  dailyBars,
  height,
  loading = false,
}: {
  dailyBars: ApiStockDaily[]
  height: number
  loading?: boolean
}) {
  const latestBar = useMemo(() => latestBarByDate(dailyBars), [dailyBars])
  const firstBar = useMemo(() => earliestBarByDate(dailyBars), [dailyBars])
  const changePct =
    firstBar.close !== 0 ? ((latestBar.close - firstBar.close) / firstBar.close) * 100 : null

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-border-muted bg-bg-elevated"
      style={{ height }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(139,92,246,0.08),transparent_45%),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,24px_24px,24px_24px]" />
      <div className="relative flex h-full flex-col justify-between gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">
              {loading ? 'Loading chart' : 'Chart preview'}
            </p>
            <p className="text-sm font-medium text-text-primary sm:text-base">
              {loading ? 'Rendering the interactive chart.' : 'Interactive chart loads when needed.'}
            </p>
          </div>
          <div className="rounded-full border border-border-muted bg-bg-surface/80 px-2.5 py-1 text-[10px] font-medium text-text-secondary">
            {dailyBars.length} bars
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border-muted bg-bg-surface/70 p-3">
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Latest close</div>
            <div className="mt-1 font-mono text-sm font-semibold text-text-primary sm:text-base">
              ${formatPrice(latestBar.close)}
            </div>
          </div>
          <div className="rounded-xl border border-border-muted bg-bg-surface/70 p-3">
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Date range</div>
            <div className="mt-1 font-mono text-xs text-text-primary sm:text-sm">
              {firstBar.date.slice(0, 10)} to {latestBar.date.slice(0, 10)}
            </div>
          </div>
          <div className="rounded-xl border border-border-muted bg-bg-surface/70 p-3">
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Period change</div>
            <div
              className={`mt-1 font-mono text-sm font-semibold sm:text-base ${
                changePct != null && changePct >= 0 ? 'text-bullish' : 'text-bearish'
              }`}
            >
              {changePct == null ? '--' : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <LoadingSkeleton className="h-24 rounded-xl" />
          <div className="grid grid-cols-4 gap-2">
            <LoadingSkeleton className="h-10 rounded-lg" />
            <LoadingSkeleton className="h-10 rounded-lg" />
            <LoadingSkeleton className="h-10 rounded-lg" />
            <LoadingSkeleton className="h-10 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function StockChart({
  dailyBars,
  spyBars,
  setups,
  height = 360,
  showMAs = true,
  showSpy = false,
  showMarkers = false,
  priority = false,
}: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(priority)

  useEffect(() => {
    if (priority) {
      setShouldLoad(true)
    }
  }, [priority])

  useEffect(() => {
    if (shouldLoad || dailyBars.length === 0 || !containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: PRELOAD_ROOT_MARGIN },
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [dailyBars.length, shouldLoad])

  if (dailyBars.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border-muted bg-bg-elevated"
        style={{ height }}
      >
        <span className="text-xs text-text-muted sm:text-sm">No chart data available</span>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full">
      {shouldLoad ? (
        <Suspense fallback={<ChartPlaceholder dailyBars={dailyBars} height={height} loading />}>
          <LazyStockChartInner
            dailyBars={dailyBars}
            spyBars={spyBars}
            setups={setups}
            height={height}
            showMAs={showMAs}
            showSpy={showSpy}
            showMarkers={showMarkers}
          />
        </Suspense>
      ) : (
        <ChartPlaceholder dailyBars={dailyBars} height={height} />
      )}
    </div>
  )
}
