import { useState, useCallback, useMemo } from 'react'
import { Search, Play, Loader2, BarChart3, AlertTriangle, Filter } from 'lucide-react'
import { fetchSimulatedSetups, type SimulatedSetup } from '@/lib/api/setups'
import { fetchStockDaily } from '@/lib/api/stocks'
import { StockChart } from '@/components/StockChart'
import { SetupTypeBadge, DirectionBadge, LoadingSkeleton, SkeletonGroup } from '@/components/shared'
import { cn, formatPrice } from '@/lib/utils'
import type { ApiStockDaily, ApiSetup, SetupType } from '@/types'

/** Convert SimulatedSetup to ApiSetup shape for the chart component */
function toChartSetup(s: SimulatedSetup): ApiSetup {
  return {
    id: s.id,
    stockId: '',
    type: s.type as ApiSetup['type'],
    timeframe: 'DAILY',
    direction: s.direction as ApiSetup['direction'],
    state: s.state as ApiSetup['state'],
    detectedAt: s.detectedAt,
    expiresAt: null,
    lastStateAt: s.detectedAt,
    pivotPrice: s.pivotPrice,
    stopPrice: s.stopPrice,
    targetPrice: s.targetPrice,
    riskReward: s.riskReward,
    evidence: s.evidence,
    waitingFor: null,
    metadata: {
      ...(s.metadata ?? {}),
      entryDate: s.entryDate,
      exitDate: s.exitDate,
      entryPrice: s.entryPrice,
      exitPrice: s.exitPrice,
      finalR: s.finalR,
      maxR: s.maxR,
    },
    dailyBaseId: null,
    stock: { id: '', ticker: '', name: '', sector: null, industry: null, exchange: null, avgVolume: null, marketCap: null, isActive: true, createdAt: '', updatedAt: '' },
  }
}

interface SimStats {
  total: number
  triggered: number
  winRate: number
  avgMaxR: number
  avgHolding: number
  byType: Record<string, { count: number; triggered: number; violated: number; expired: number }>
  byDirection: { LONG: number; SHORT: number }
}

function computeStats(setups: SimulatedSetup[]): SimStats {
  const byType: SimStats['byType'] = {}
  let longCount = 0
  let shortCount = 0
  let triggeredCount = 0
  let winCount = 0
  let totalMaxR = 0
  let totalHolding = 0
  let holdingCount = 0
  let maxRCount = 0

  for (const s of setups) {
    if (!byType[s.type]) {
      byType[s.type] = { count: 0, triggered: 0, violated: 0, expired: 0 }
    }
    byType[s.type].count++

    if (s.direction === 'LONG') longCount++
    else shortCount++

    if (s.entryDate) {
      triggeredCount++
      byType[s.type].triggered++

      if (s.maxR != null) {
        totalMaxR += s.maxR
        maxRCount++
        if (s.maxR >= 3) winCount++
      }

      if (s.holdingDays != null) {
        totalHolding += s.holdingDays
        holdingCount++
      }

      if (s.state === 'VIOLATED') byType[s.type].violated++
      else if (s.state === 'EXPIRED') byType[s.type].expired++
    } else {
      if (s.state === 'VIOLATED') byType[s.type].violated++
      else if (s.state === 'EXPIRED') byType[s.type].expired++
    }
  }

  return {
    total: setups.length,
    triggered: triggeredCount,
    winRate: triggeredCount > 0 ? (winCount / triggeredCount) * 100 : 0,
    avgMaxR: maxRCount > 0 ? totalMaxR / maxRCount : 0,
    avgHolding: holdingCount > 0 ? Math.round(totalHolding / holdingCount) : 0,
    byType,
    byDirection: { LONG: longCount, SHORT: shortCount },
  }
}

export default function Simulate() {
  const [ticker, setTicker] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setups, setSetups] = useState<SimulatedSetup[]>([])
  const [dailyBars, setDailyBars] = useState<ApiStockDaily[]>([])
  const [hasRun, setHasRun] = useState(false)

  const runSimulation = useCallback(async () => {
    if (!ticker.trim()) return
    setLoading(true)
    setError(null)
    setHasRun(true)

    try {
      const [simResult, bars] = await Promise.all([
        fetchSimulatedSetups(ticker.trim()),
        fetchStockDaily(ticker.trim(), 5000),
      ])
      setSetups(simResult)
      setDailyBars(bars)
    } catch (err) {
      setError((err as Error).message)
      setSetups([])
      setDailyBars([])
    } finally {
      setLoading(false)
    }
  }, [ticker])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') runSimulation()
    },
    [runSimulation],
  )

  // Setup type filter state
  const [hiddenSetupTypes, setHiddenSetupTypes] = useState<Set<SetupType>>(new Set())

  // Deduplicate setups: group by type+pivotPrice, keep best signal per group
  const deduplicatedSetups = useMemo(() => {
    if (setups.length === 0 || dailyBars.length === 0) return setups

    const groups = new Map<string, SimulatedSetup[]>()
    for (const setup of setups) {
      if (setup.pivotPrice == null) {
        // No pivot — keep as-is (unique group)
        groups.set(`no-pivot-${setup.id}`, [setup])
        continue
      }
      const key = `${setup.type}:${setup.pivotPrice}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(setup)
    }

    const result: SimulatedSetup[] = []
    for (const [, group] of groups) {
      if (group.length === 1) {
        result.push(group[0])
        continue
      }

      // Find bars for each setup's detectedAt date
      const setupsWithBars = group
        .map((s) => {
          const detectedDate = s.detectedAt.slice(0, 10)
          const bar = dailyBars.find((b) => b.date.slice(0, 10) === detectedDate)
          return { setup: s, bar }
        })
        .filter((item) => item.bar != null)

      if (setupsWithBars.length === 0) {
        result.push(group[0])
        continue
      }

      const firstSetup = setupsWithBars[0].setup
      if (firstSetup.direction === 'SHORT') {
        // SHORT: pick setup with lowest bar.low
        const best = setupsWithBars.reduce((acc, cur) =>
          cur.bar!.low < acc.bar!.low ? cur : acc,
        )
        result.push(best.setup)
      } else {
        // LONG: pick setup with highest bar.high
        const best = setupsWithBars.reduce((acc, cur) =>
          cur.bar!.high > acc.bar!.high ? cur : acc,
        )
        result.push(best.setup)
      }
    }
    return result
  }, [setups, dailyBars])

  // Apply type filter
  const filteredSetups = useMemo(() => {
    return deduplicatedSetups.filter((s) => !hiddenSetupTypes.has(s.type as SetupType))
  }, [deduplicatedSetups, hiddenSetupTypes])

  // Get unique setup types for filter UI
  const availableSetupTypes = useMemo(() => {
    const types = new Set<SetupType>()
    for (const s of deduplicatedSetups) {
      types.add(s.type as SetupType)
    }
    return Array.from(types).sort()
  }, [deduplicatedSetups])

  const toggleSetupType = (type: SetupType) => {
    setHiddenSetupTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const stats = filteredSetups.length > 0 ? computeStats(filteredSetups) : null

  // All triggered setups for the chart
  const chartSetups = filteredSetups
    .filter((s) => s.entryDate != null)
    .map(toChartSetup)

  // Triggered setups for the trade table
  const triggeredSetups = filteredSetups.filter((s) => s.entryDate != null)
  const neverTriggered = filteredSetups.length - triggeredSetups.length

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <BarChart3 className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
        <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
          Setup Simulator
        </h1>
      </div>

      <p className="text-xs text-text-secondary sm:text-sm">
        Run setup detection across a stock's full history to verify detection logic and review outcomes.
      </p>

      {/* Search bar */}
      <div className="flex gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Enter ticker (e.g., AAPL, NVDA, TSLA)..."
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            className="w-full rounded-xl border border-border-default bg-bg-surface py-2.5 pl-10 pr-4 text-sm font-medium text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 sm:py-3"
          />
        </div>
        <button
          onClick={runSimulation}
          disabled={loading || !ticker.trim()}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors sm:px-6 sm:py-3',
            loading || !ticker.trim()
              ? 'cursor-not-allowed bg-bg-elevated text-text-muted'
              : 'bg-accent text-white hover:bg-accent/90',
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {loading ? 'Running...' : 'Simulate'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <LoadingSkeleton className="h-[400px] rounded-xl" />
          <SkeletonGroup count={3}>
            <LoadingSkeleton className="h-20 rounded-xl" />
          </SkeletonGroup>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-bearish/30 bg-bearish/5 p-4 text-sm text-bearish">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && hasRun && !error && (
        <>
          {/* Setup type filter */}
          {availableSetupTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-text-muted" />
              {availableSetupTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleSetupType(type)}
                  className={cn(
                    'cursor-pointer rounded-full border border-border-default px-2 py-0.5 text-[10px] font-medium transition-opacity sm:text-xs',
                    hiddenSetupTypes.has(type)
                      ? 'opacity-40 line-through'
                      : 'bg-bg-elevated text-text-primary',
                  )}
                >
                  {type.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}

          {/* Chart */}
          {dailyBars.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border-default bg-bg-surface p-3 sm:p-4">
              <h2 className="mb-3 text-sm font-semibold text-text-primary sm:text-base">
                {ticker} - Historical Chart with Entry/Exit Markers
              </h2>
              <StockChart
                dailyBars={dailyBars}
                setups={chartSetups}
                height={450}
                showMAs
                showMarkers
              />
            </div>
          )}

          {/* Stats summary */}
          {stats && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 sm:gap-4">
              <StatCard label="Total Setups" value={String(stats.total)} />
              <StatCard label="Triggered" value={String(stats.triggered)} />
              <StatCard
                label="Win Rate (3R+)"
                value={`${stats.winRate.toFixed(1)}%`}
              />
              <StatCard
                label="Avg Max R"
                value={stats.avgMaxR.toFixed(1)}
              />
              <StatCard
                label="Avg Hold Days"
                value={String(stats.avgHolding)}
              />
              <StatCard
                label="Never Triggered"
                value={String(neverTriggered)}
              />
            </div>
          )}

          {/* Setup type breakdown */}
          {stats && Object.keys(stats.byType).length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border-default">
              <div className="border-b border-border-default bg-bg-elevated px-4 py-3 sm:px-5">
                <h3 className="text-sm font-semibold text-text-primary sm:text-base">
                  Setup Type Breakdown
                </h3>
              </div>
              <div className="divide-y divide-border-default">
                {Object.entries(stats.byType)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([type, data]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between px-4 py-3 sm:px-5"
                    >
                      <SetupTypeBadge type={type as ApiSetup['type']} />
                      <div className="flex gap-4 text-xs sm:gap-6 sm:text-sm">
                        <span className="text-text-secondary">
                          <span className="font-mono font-medium text-text-primary">{data.count}</span> total
                        </span>
                        <span className="text-bullish">
                          <span className="font-mono font-medium">{data.triggered}</span> triggered
                        </span>
                        <span className="text-bearish">
                          <span className="font-mono font-medium">{data.violated}</span> violated
                        </span>
                        <span className="text-text-muted">
                          <span className="font-mono font-medium">{data.expired}</span> expired
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Trade results table */}
          {triggeredSetups.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border-default">
              <div className="border-b border-border-default bg-bg-elevated px-4 py-3 sm:px-5">
                <h3 className="text-sm font-semibold text-text-primary sm:text-base">
                  Trade Results ({triggeredSetups.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-bg-elevated text-left text-[10px] font-medium uppercase tracking-wider text-text-muted sm:text-xs">
                      <th className="px-3 py-2.5 sm:px-4">Type</th>
                      <th className="px-3 py-2.5 sm:px-4">Dir</th>
                      <th className="px-3 py-2.5 sm:px-4">Entry Date</th>
                      <th className="px-3 py-2.5 sm:px-4 text-right">Entry $</th>
                      <th className="px-3 py-2.5 sm:px-4 text-right">Stop $</th>
                      <th className="px-3 py-2.5 sm:px-4">Exit Date</th>
                      <th className="px-3 py-2.5 sm:px-4 text-right">Exit $</th>
                      <th className="px-3 py-2.5 sm:px-4 text-right">Max R</th>
                      <th className="px-3 py-2.5 sm:px-4 text-right">Max %</th>
                      <th className="px-3 py-2.5 sm:px-4 text-right">Final R</th>
                      <th className="px-3 py-2.5 sm:px-4 text-right">Hold</th>
                      <th className="px-3 py-2.5 sm:px-4 text-center">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {triggeredSetups.map((s) => {
                      const isWin = s.maxR != null && s.maxR >= 3
                      const isViolated = s.state === 'VIOLATED'

                      return (
                        <tr
                          key={s.id}
                          className={cn(
                            'transition-colors hover:bg-bg-hover',
                            isWin && 'bg-bullish/[0.03]',
                            !isWin && isViolated && 'bg-bearish/[0.03]',
                          )}
                        >
                          <td className="px-3 py-2 sm:px-4">
                            <SetupTypeBadge type={s.type as ApiSetup['type']} />
                          </td>
                          <td className="px-3 py-2 sm:px-4">
                            <DirectionBadge direction={s.direction as ApiSetup['direction']} />
                          </td>
                          <td className="px-3 py-2 font-mono text-text-secondary sm:px-4">
                            {s.entryDate?.slice(0, 10) ?? '--'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-primary sm:px-4">
                            {s.entryPrice != null ? `$${formatPrice(s.entryPrice)}` : '--'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-bearish/70 sm:px-4">
                            {s.actualStopPrice != null ? `$${formatPrice(s.actualStopPrice)}` : '--'}
                          </td>
                          <td className="px-3 py-2 font-mono text-text-secondary sm:px-4">
                            {s.exitDate?.slice(0, 10) ?? '--'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-primary sm:px-4">
                            {s.exitPrice != null ? `$${formatPrice(s.exitPrice)}` : '--'}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right font-mono font-medium sm:px-4',
                              s.maxR != null && s.maxR >= 3 ? 'text-bullish' : 'text-text-secondary',
                            )}
                          >
                            {s.maxR != null ? `${s.maxR.toFixed(1)}R` : '--'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary sm:px-4">
                            {s.maxPct != null ? `${s.maxPct.toFixed(1)}%` : '--'}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right font-mono font-medium sm:px-4',
                              s.finalR != null && s.finalR >= 0 ? 'text-bullish' : 'text-bearish',
                            )}
                          >
                            {s.finalR != null ? `${s.finalR.toFixed(1)}R` : '--'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-muted sm:px-4">
                            {s.holdingDays != null ? `${s.holdingDays}d` : '--'}
                          </td>
                          <td className="px-3 py-2 text-center sm:px-4">
                            <span
                              className={cn(
                                'rounded px-2 py-0.5 text-[10px] font-semibold sm:text-xs',
                                s.state === 'TRIGGERED' && 'bg-accent/10 text-accent',
                                s.state === 'VIOLATED' && 'bg-bearish/10 text-bearish',
                                s.state === 'EXPIRED' && 'bg-text-muted/10 text-text-muted',
                              )}
                            >
                              {s.state}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {setups.length === 0 && (
            <div className="flex h-40 items-center justify-center text-sm text-text-muted">
              No setups detected for {ticker}
            </div>
          )}
        </>
      )}

      {/* Initial state */}
      {!hasRun && !loading && (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border border-border-default bg-bg-surface">
          <BarChart3 className="h-10 w-10 text-text-muted/30 sm:h-12 sm:w-12" />
          <p className="text-sm text-text-muted">Enter a ticker and click Simulate to begin</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-3 sm:p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted sm:text-xs">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-bold text-text-primary sm:text-2xl">
        {value}
      </p>
    </div>
  )
}
