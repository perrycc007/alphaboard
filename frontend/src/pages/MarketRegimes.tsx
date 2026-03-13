import {
  Globe2,
  ArrowUpRight,
  ArrowDownRight,
  CalendarRange,
  Filter,
  Search,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { fetchMarketRegimes } from '@/lib/api/market'
import { cn, formatPrice } from '@/lib/utils'
import { useSlidePanelStore } from '@/stores/useSlidePanelStore'
import { EmptyState, LoadingSkeleton, SkeletonGroup, SetupTypeBadge } from '@/components/shared'
import type {
  ApiMarketProxyState,
  ApiMarketRegimePeriod,
  ApiMarketScoreMetric,
  ApiPeriodLeaderSummary,
  MarketPeriodGranularity,
  MarketRegimeLabel,
  MarketTrendLabel,
  SetupFamily,
  StageEnum,
} from '@/types'

type Granularity = MarketPeriodGranularity
type PeriodSort = 'NEWEST' | 'OLDEST' | 'LEADERS' | 'REVERSAL' | 'TREND'
type LeaderSort = 'PEAK_GAIN' | 'TICKER' | 'STAGE' | 'SHORTABLE'

type DisplayLeader = ApiPeriodLeaderSummary & {
  appearances: number
  primarySetup: ApiPeriodLeaderSummary['activeSetups'][number] | null
}

type DisplayPeriod = {
  id: string
  key: string
  label: string
  startDate: string
  endDate: string
  labelRaw: MarketRegimeLabel | 'MIXED'
  scorecard: Record<SetupFamily, ApiMarketScoreMetric>
  proxyStates: ApiMarketProxyState[]
  leaders: DisplayLeader[]
  liveSampleCount: number
  simulatedSampleCount: number
  periods: ApiMarketRegimePeriod[]
}

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'REGIME', label: 'Regime windows' },
  { value: 'MONTH', label: 'Monthly' },
  { value: 'YEAR', label: 'Yearly' },
]

const REGIME_FILTERS: { value: 'ALL' | MarketRegimeLabel; label: string }[] = [
  { value: 'ALL', label: 'All regimes' },
  { value: 'TREND_UP', label: 'Trend up' },
  { value: 'TREND_DOWN', label: 'Trend down' },
  { value: 'RANGE', label: 'Range' },
  { value: 'TRANSITION', label: 'Transition' },
]

const FAMILY_FILTERS: { value: 'ALL' | SetupFamily; label: string }[] = [
  { value: 'ALL', label: 'All families' },
  { value: 'REVERSAL', label: 'Reversal' },
  { value: 'TREND_LONG', label: 'Trend long' },
  { value: 'TREND_SHORT', label: 'Trend short' },
]

const PERIOD_SORTS: { value: PeriodSort; label: string }[] = [
  { value: 'NEWEST', label: 'Newest first' },
  { value: 'OLDEST', label: 'Oldest first' },
  { value: 'LEADERS', label: 'Most leaders' },
  { value: 'REVERSAL', label: 'Reversal edge' },
  { value: 'TREND', label: 'Trend edge' },
]

const LEADER_SORTS: { value: LeaderSort; label: string }[] = [
  { value: 'PEAK_GAIN', label: 'Peak gain' },
  { value: 'TICKER', label: 'Ticker' },
  { value: 'STAGE', label: 'Stage' },
  { value: 'SHORTABLE', label: 'Shortable first' },
]

const FAMILY_KEYS: SetupFamily[] = ['REVERSAL', 'TREND_LONG', 'TREND_SHORT']
const PROXY_ORDER = ['SPY', 'QQQ', 'IWM', 'GLD', 'UUP']

export default function MarketRegimes() {
  const [periods, setPeriods] = useState<ApiMarketRegimePeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [granularity, setGranularity] = useState<Granularity>('REGIME')
  const [regimeFilter, setRegimeFilter] = useState<'ALL' | MarketRegimeLabel>('ALL')
  const [familyFilter, setFamilyFilter] = useState<'ALL' | SetupFamily>('ALL')
  const [periodSort, setPeriodSort] = useState<PeriodSort>('NEWEST')
  const [leaderSort, setLeaderSort] = useState<LeaderSort>('PEAK_GAIN')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase())

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null)
  const [selectedLeaderTicker, setSelectedLeaderTicker] = useState<string | null>(null)

  const openPanel = useSlidePanelStore((s) => s.openPanel)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchMarketRegimes({ granularity })
        if (!cancelled) {
          setPeriods(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [granularity])

  const groupedPeriods = useMemo(() => buildDisplayPeriods(periods), [periods])

  const filteredPeriods = useMemo(() => {
    const query = deferredSearch

    const next = groupedPeriods
      .filter((period) => regimeFilter === 'ALL' || period.labelRaw === regimeFilter)
      .filter((period) => {
        if (familyFilter === 'ALL') return true
        return getDominantFamily(period.scorecard) === familyFilter
      })
      .filter((period) => {
        if (!query) return true
        const leaderMatch = period.leaders.some(
          (leader) =>
            leader.ticker.toLowerCase().includes(query) ||
            leader.name.toLowerCase().includes(query),
        )
        const proxyMatch = period.proxyStates.some((proxy) =>
          proxy.ticker.toLowerCase().includes(query),
        )
        return (
          leaderMatch ||
          proxyMatch ||
          period.label.toLowerCase().includes(query) ||
          period.labelRaw.toLowerCase().includes(query)
        )
      })

    return [...next].sort((a, b) => sortPeriods(a, b, periodSort))
  }, [groupedPeriods, regimeFilter, familyFilter, deferredSearch, periodSort])

  useEffect(() => {
    if (filteredPeriods.length === 0) {
      setSelectedPeriodKey(null)
      return
    }
    if (!selectedPeriodKey || !filteredPeriods.some((period) => period.key === selectedPeriodKey)) {
      setSelectedPeriodKey(filteredPeriods[0].key)
    }
  }, [filteredPeriods, selectedPeriodKey])

  const selectedPeriod = useMemo(
    () => filteredPeriods.find((period) => period.key === selectedPeriodKey) ?? null,
    [filteredPeriods, selectedPeriodKey],
  )

  const leaderRows = useMemo(() => {
    if (!selectedPeriod) return []
    return [...selectedPeriod.leaders].sort((a, b) => sortLeaders(a, b, leaderSort))
  }, [selectedPeriod, leaderSort])

  useEffect(() => {
    if (leaderRows.length === 0) {
      setSelectedLeaderTicker(null)
      return
    }
    if (!selectedLeaderTicker || !leaderRows.some((leader) => leader.ticker === selectedLeaderTicker)) {
      setSelectedLeaderTicker(leaderRows[0].ticker)
    }
  }, [leaderRows, selectedLeaderTicker])

  const selectedLeader = useMemo(
    () => leaderRows.find((leader) => leader.ticker === selectedLeaderTicker) ?? null,
    [leaderRows, selectedLeaderTicker],
  )

  const leaderTimeline = useMemo(() => {
    if (!selectedLeaderTicker) return []

    return filteredPeriods
      .map((period) => {
        const leader = period.leaders.find((item) => item.ticker === selectedLeaderTicker)
        return leader ? { period, leader } : null
      })
      .filter((item): item is { period: DisplayPeriod; leader: DisplayLeader } => item != null)
      .sort(
        (a, b) =>
          new Date(a.period.startDate).getTime() - new Date(b.period.startDate).getTime(),
      )
  }, [filteredPeriods, selectedLeaderTicker])

  const summary = useMemo(() => buildSummary(filteredPeriods), [filteredPeriods])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 sm:gap-3">
            <Globe2 className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
            <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
              Market Regime & Leaders
            </h1>
          </div>
          <p className="max-w-3xl text-xs text-text-secondary sm:text-sm">
            Read the market from top down: macro regime first, then the qualified past leaders
            active inside each period, then drill into a single leader timeline.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Visible periods"
          value={String(summary.periodCount)}
          detail={`${summary.rangeStart} to ${summary.rangeEnd}`}
        />
        <SummaryCard
          label="Dominant regime"
          value={humanizeRegime(summary.dominantRegime)}
          detail={`${summary.dominantRegimeCount} windows`}
          tone={summary.dominantRegime === 'RANGE' ? 'warning' : 'accent'}
        />
        <SummaryCard
          label="Qualified leaders"
          value={String(summary.uniqueLeaders)}
          detail={`${summary.shortReadyLeaders} short-ready`}
          tone="bullish"
        />
        <SummaryCard
          label="Leading family"
          value={summary.leadingFamily ? humanizeFamily(summary.leadingFamily) : 'N/A'}
          detail={`${summary.liveSamples} live / ${summary.simulatedSamples} sim`}
          tone={summary.leadingFamily === 'REVERSAL' ? 'warning' : 'accent'}
        />
      </div>

      <div className="rounded-2xl border border-border-default bg-bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted sm:text-xs">
              <Filter className="h-3.5 w-3.5" />
              Period Controls
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => startTransition(() => setGranularity(option.value))}
                  className={cn(
                    'cursor-pointer rounded-full px-3 py-1.5 text-[10px] font-medium transition-colors sm:text-xs',
                    granularity === option.value
                      ? 'bg-accent/15 text-accent'
                      : 'bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Regime"
              value={regimeFilter}
              onChange={(value) =>
                startTransition(() => setRegimeFilter(value as 'ALL' | MarketRegimeLabel))
              }
              options={REGIME_FILTERS}
            />
            <FilterSelect
              label="Family"
              value={familyFilter}
              onChange={(value) =>
                startTransition(() => setFamilyFilter(value as 'ALL' | SetupFamily))
              }
              options={FAMILY_FILTERS}
            />
            <FilterSelect
              label="Period sort"
              value={periodSort}
              onChange={(value) => startTransition(() => setPeriodSort(value as PeriodSort))}
              options={PERIOD_SORTS}
            />
            <FilterSelect
              label="Leader sort"
              value={leaderSort}
              onChange={(value) => startTransition(() => setLeaderSort(value as LeaderSort))}
              options={LEADER_SORTS}
            />
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search period label, leader ticker, or macro proxy..."
            className="w-full rounded-xl border border-border-default bg-bg-elevated py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border-default bg-bg-surface">
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-heading text-sm font-semibold text-text-primary sm:text-base">
              Period Table
            </h2>
            <p className="text-[10px] text-text-muted sm:text-xs">
              Click a period to inspect its leaders and timeline context.
            </p>
          </div>
          {filteredPeriods.length > 0 ? (
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent sm:text-xs">
              {filteredPeriods.length} periods
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="p-4 sm:p-5">
            <SkeletonGroup count={6}>
              <LoadingSkeleton className="h-16 rounded-xl" />
            </SkeletonGroup>
          </div>
        ) : error ? (
          <div className="p-4 sm:p-5">
            <div className="rounded-xl border border-bearish/30 bg-bearish/5 p-4 text-sm text-bearish">
              Failed to load market regimes: {error}
            </div>
          </div>
        ) : filteredPeriods.length === 0 ? (
          <EmptyState
            className="px-4"
            icon={CalendarRange}
            title="No periods match these filters"
            description="Try widening the regime or family filter to bring more market windows back into view."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px]">
              <thead className="bg-bg-elevated text-left text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted sm:text-xs">
                <tr>
                  <th className="px-4 py-3 sm:px-5">Period</th>
                  <th className="px-4 py-3">Regime</th>
                  <th className="px-4 py-3">Macro context</th>
                  <th className="px-4 py-3">Working now</th>
                  <th className="px-4 py-3">Leaders</th>
                  <th className="px-4 py-3 text-right">Short-ready</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {filteredPeriods.map((period) => {
                  const dominantFamily = getDominantFamily(period.scorecard)
                  const shortReadyCount = period.leaders.filter((leader) => leader.shortingEnabled).length

                  return (
                    <tr
                      key={period.key}
                      onClick={() => setSelectedPeriodKey(period.key)}
                      className={cn(
                        'cursor-pointer align-top transition-colors hover:bg-bg-hover/60',
                        selectedPeriod?.key === period.key && 'bg-accent/6',
                      )}
                    >
                      <td className="px-4 py-3.5 sm:px-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-sm font-semibold text-text-primary sm:text-base">
                              {period.label}
                            </span>
                            <ChevronRight
                              className={cn(
                                'h-4 w-4 text-text-muted transition-transform',
                                selectedPeriod?.key === period.key && 'translate-x-0.5 text-accent',
                              )}
                            />
                          </div>
                          <div className="text-[10px] text-text-muted sm:text-xs">
                            {formatDateRange(period.startDate, period.endDate)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-2">
                          <RegimeBadge label={period.labelRaw} />
                          <div className="text-[10px] text-text-muted sm:text-xs">
                            {period.liveSampleCount} live / {period.simulatedSampleCount} sim
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex max-w-md flex-wrap gap-1.5">
                          {period.proxyStates.map((proxy) => (
                            <ProxyChip key={`${period.key}-${proxy.ticker}`} proxy={proxy} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-2">
                          {FAMILY_KEYS.map((family) => (
                            <FamilyScorePill
                              key={`${period.key}-${family}`}
                              family={family}
                              metric={period.scorecard[family]}
                              active={dominantFamily === family}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {period.leaders.slice(0, 4).map((leader) => (
                              <button
                                key={`${period.key}-${leader.ticker}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setSelectedPeriodKey(period.key)
                                  setSelectedLeaderTicker(leader.ticker)
                                }}
                                className={cn(
                                  'cursor-pointer rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors sm:text-xs',
                                  selectedLeaderTicker === leader.ticker && selectedPeriod?.key === period.key
                                    ? 'border-accent/40 bg-accent/15 text-accent'
                                    : 'border-border-default bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                                )}
                              >
                                {leader.ticker}
                              </button>
                            ))}
                          </div>
                          <div className="text-[10px] text-text-muted sm:text-xs">
                            {period.leaders.length} qualified leaders
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="space-y-1">
                          <div className="font-mono text-sm font-semibold text-text-primary sm:text-base">
                            {shortReadyCount}
                          </div>
                          <div className="text-[10px] text-text-muted sm:text-xs">
                            of {period.leaders.length}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPeriod ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-default bg-bg-surface p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-lg font-semibold text-text-primary sm:text-xl">
                    {selectedPeriod.label}
                  </h2>
                  <RegimeBadge label={selectedPeriod.labelRaw} />
                </div>
                <p className="text-xs text-text-secondary sm:text-sm">
                  {formatDateRange(selectedPeriod.startDate, selectedPeriod.endDate)}. Click a
                  leader below to inspect how it moved through this market window.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {FAMILY_KEYS.map((family) => (
                  <MetricCard
                    key={`${selectedPeriod.key}-${family}`}
                    family={family}
                    metric={selectedPeriod.scorecard[family]}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
            <div className="rounded-2xl border border-border-default bg-bg-surface">
              <div className="flex items-center justify-between border-b border-border-default px-4 py-3 sm:px-5">
                <div>
                  <h3 className="font-heading text-sm font-semibold text-text-primary sm:text-base">
                    Past Leader Table
                  </h3>
                  <p className="text-[10px] text-text-muted sm:text-xs">
                    What each qualified leader was doing during this selected period.
                  </p>
                </div>
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent sm:text-xs">
                  {leaderRows.length} leaders
                </span>
              </div>

              {leaderRows.length === 0 ? (
                <EmptyState
                  className="px-4"
                  title="No leaders inside this period"
                  description="This market window did not keep any qualified Stage 2 leader in scope."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px]">
                    <thead className="bg-bg-elevated text-left text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted sm:text-xs">
                      <tr>
                        <th className="px-4 py-3 sm:px-5">Leader</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3">Daily setup</th>
                        <th className="px-4 py-3 text-right">Peak gain</th>
                        <th className="px-4 py-3 text-right">Shortable</th>
                        <th className="px-4 py-3 text-right">Timeline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {leaderRows.map((leader) => (
                        <tr
                          key={`${selectedPeriod.key}-${leader.ticker}`}
                          onClick={() => setSelectedLeaderTicker(leader.ticker)}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-bg-hover/60',
                            selectedLeaderTicker === leader.ticker && 'bg-accent/6',
                          )}
                        >
                          <td className="px-4 py-3.5 sm:px-5">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openPanel(leader.ticker)
                                }}
                                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-xs font-bold text-accent transition-colors hover:bg-accent/15"
                              >
                                {leader.ticker.slice(0, 2)}
                              </button>
                              <div>
                                <div className="font-heading text-sm font-semibold text-text-primary sm:text-base">
                                  {leader.ticker}
                                </div>
                                <div className="text-[10px] text-text-secondary sm:text-xs">
                                  {leader.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="space-y-1">
                              <StatusPill leader={leader} />
                              {leader.activityNote ? (
                                <div className="text-[10px] text-text-secondary sm:text-xs">
                                  {leader.activityNote}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <StagePill stage={leader.stageAtPeriodEnd} />
                          </td>
                          <td className="px-4 py-3.5">
                            {leader.primarySetup ? (
                              <div className="space-y-1">
                                <SetupTypeBadge type={leader.primarySetup.type} />
                                <div className="text-[10px] text-text-muted sm:text-xs">
                                  {leader.primarySetup.state} · {leader.primarySetup.direction}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-text-muted">Quiet / no active setup</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="font-mono text-sm font-semibold text-bullish sm:text-base">
                              +{leader.peakGainPct.toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-text-muted sm:text-xs">
                              ${formatPrice(leader.entryPrice)} → ${formatPrice(leader.peakPrice)}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span
                              className={cn(
                                'rounded-full px-2 py-1 text-[10px] font-semibold sm:text-xs',
                                leader.shortingEnabled
                                  ? 'bg-bearish/12 text-bearish'
                                  : 'bg-bg-elevated text-text-muted',
                              )}
                            >
                              {leader.shortingEnabled ? 'Enabled' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="font-mono text-sm text-text-primary sm:text-base">
                              {leader.appearances}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border-default bg-bg-surface p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-sm font-semibold text-text-primary sm:text-base">
                      Leader Timeline
                    </h3>
                    <p className="text-[10px] text-text-muted sm:text-xs">
                      Track one past leader across the visible market windows.
                    </p>
                  </div>
                  {selectedLeader ? (
                    <button
                      onClick={() => openPanel(selectedLeader.ticker)}
                      className="flex cursor-pointer items-center gap-1 rounded-lg border border-border-default bg-bg-elevated px-2.5 py-1.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary sm:text-xs"
                    >
                      Open stock
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {!selectedLeader ? (
                  <EmptyState
                    className="py-8"
                    icon={Sparkles}
                    title="Pick a leader"
                    description="Select a row from the leader table to inspect its timeline."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border-default bg-bg-elevated p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-heading text-base font-semibold text-text-primary">
                            {selectedLeader.ticker}
                          </div>
                          <div className="text-xs text-text-secondary">{selectedLeader.name}</div>
                        </div>
                        <StagePill stage={selectedLeader.stageAtPeriodEnd} />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <MiniMetric label="Peak gain" value={`+${selectedLeader.peakGainPct.toFixed(1)}%`} tone="bullish" />
                        <MiniMetric
                          label="Short rule"
                          value={selectedLeader.shortingEnabled ? 'Enabled' : 'Blocked'}
                          tone={selectedLeader.shortingEnabled ? 'bearish' : 'muted'}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {leaderTimeline.map(({ period, leader }) => (
                        <div
                          key={`${period.key}-${leader.ticker}`}
                          className={cn(
                            'rounded-xl border p-3 transition-colors',
                            period.key === selectedPeriod.key
                              ? 'border-accent/30 bg-accent/6'
                              : 'border-border-default bg-bg-elevated',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-text-primary">{period.label}</div>
                              <div className="text-[10px] text-text-muted sm:text-xs">
                                {formatDateRange(period.startDate, period.endDate)}
                              </div>
                            </div>
                            <RegimeBadge label={period.labelRaw} compact />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {period.proxyStates.map((proxy) => (
                              <ProxyChip key={`${period.key}-${leader.ticker}-${proxy.ticker}`} proxy={proxy} compact />
                            ))}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <StagePill stage={leader.stageAtPeriodEnd} compact />
                            {leader.primarySetup ? (
                              <SetupTypeBadge type={leader.primarySetup.type} />
                            ) : (
                              <span className="rounded-full bg-bg-overlay px-2 py-1 text-[10px] text-text-muted">
                                No active setup
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
})

const EMPTY_METRIC: ApiMarketScoreMetric = {
  count: 0,
  winRate: 0,
  avgFinalR: 0,
  source: 'NONE',
  liveCount: 0,
  simulatedCount: 0,
}

function buildDisplayPeriods(periods: ApiMarketRegimePeriod[]): DisplayPeriod[] {
  return [...periods]
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .map((period) => ({
      id: period.id,
      key: period.periodKey,
      label: formatPeriodLabel(period),
      startDate: period.startDate,
      endDate: period.endDate,
      labelRaw: period.label,
      scorecard: normalizeScorecard(period.scorecard),
      proxyStates: [...period.proxyStates].sort(
        (a, b) => PROXY_ORDER.indexOf(a.ticker) - PROXY_ORDER.indexOf(b.ticker),
      ),
      leaders: aggregateLeaders([period]),
      liveSampleCount: period.liveSampleCount,
      simulatedSampleCount: period.simulatedSampleCount,
      periods: [period],
    }))
}

function normalizeScorecard(
  scorecard: Partial<Record<SetupFamily, ApiMarketScoreMetric>>,
): Record<SetupFamily, ApiMarketScoreMetric> {
  return {
    REVERSAL: scorecard.REVERSAL ?? EMPTY_METRIC,
    TREND_LONG: scorecard.TREND_LONG ?? EMPTY_METRIC,
    TREND_SHORT: scorecard.TREND_SHORT ?? EMPTY_METRIC,
  }
}

function formatPeriodLabel(period: ApiMarketRegimePeriod) {
  if (period.granularity === 'YEAR') {
    return period.periodKey
  }

  if (period.granularity === 'MONTH') {
    const [year, month] = period.periodKey.split('-')
    if (year && month) {
      return MONTH_FORMATTER.format(new Date(`${year}-${month}-01T00:00:00.000Z`))
    }
  }

  return formatDateRange(period.startDate, period.endDate)
}

function aggregateScorecards(
  periods: ApiMarketRegimePeriod[],
): Record<SetupFamily, ApiMarketScoreMetric> {
  const next = {} as Record<SetupFamily, ApiMarketScoreMetric>

  for (const family of FAMILY_KEYS) {
    const metrics = periods
      .map((period) => normalizeScorecard(period.scorecard)[family])
      .filter(Boolean)

    const count = metrics.reduce((sum, item) => sum + item.count, 0)
    const liveCount = metrics.reduce((sum, item) => sum + item.liveCount, 0)
    const simulatedCount = metrics.reduce((sum, item) => sum + item.simulatedCount, 0)
    const weightedWin = metrics.reduce((sum, item) => sum + item.winRate * item.count, 0)
    const weightedR = metrics.reduce((sum, item) => sum + item.avgFinalR * item.count, 0)

    next[family] = {
      count,
      winRate: count > 0 ? weightedWin / count : 0,
      avgFinalR: count > 0 ? weightedR / count : 0,
      source: deriveMetricSource(liveCount, simulatedCount),
      liveCount,
      simulatedCount,
    }
  }

  return next
}

function deriveMetricSource(
  liveCount: number,
  simulatedCount: number,
): ApiMarketScoreMetric['source'] {
  if (liveCount > 0 && simulatedCount > 0) return 'MIXED'
  if (liveCount > 0) return 'LIVE'
  if (simulatedCount > 0) return 'SIMULATED'
  return 'NONE'
}

function aggregateLeaders(periods: ApiMarketRegimePeriod[]): DisplayLeader[] {
  const leaderMap = new Map<string, DisplayLeader>()

  for (const period of periods) {
    for (const leader of period.leaderSummary) {
      const primarySetup = leader.activeSetups[0] ?? null
      const existing = leaderMap.get(leader.ticker)

      if (!existing) {
        leaderMap.set(leader.ticker, {
          ...leader,
          activeSetups: uniqueSetups(leader.activeSetups),
          appearances: 1,
          primarySetup,
        })
        continue
      }

      const entryCandidate =
        leader.peakGainPct > existing.peakGainPct ? leader.entryPrice : existing.entryPrice
      const peakCandidate =
        leader.peakGainPct > existing.peakGainPct ? leader.peakPrice : existing.peakPrice

      leaderMap.set(leader.ticker, {
        ...existing,
        name: leader.name || existing.name,
        stage2StartDate:
          new Date(leader.stage2StartDate).getTime() < new Date(existing.stage2StartDate).getTime()
            ? leader.stage2StartDate
            : existing.stage2StartDate,
        stage2EndDate:
          new Date(leader.stage2EndDate).getTime() > new Date(existing.stage2EndDate).getTime()
            ? leader.stage2EndDate
            : existing.stage2EndDate,
        peakGainPct: Math.max(existing.peakGainPct, leader.peakGainPct),
        entryPrice: entryCandidate,
        peakPrice: peakCandidate,
        stageAtPeriodEnd: leader.stageAtPeriodEnd ?? existing.stageAtPeriodEnd,
        activeSetups: uniqueSetups([...existing.activeSetups, ...leader.activeSetups]),
        shortingEnabled: existing.shortingEnabled || leader.shortingEnabled,
        appearances: existing.appearances + 1,
        primarySetup: primarySetup ?? existing.primarySetup,
      })
    }
  }

  return [...leaderMap.values()].sort((a, b) => b.peakGainPct - a.peakGainPct)
}

function uniqueSetups(setups: ApiPeriodLeaderSummary['activeSetups']) {
  const map = new Map<string, ApiPeriodLeaderSummary['activeSetups'][number]>()

  for (const setup of setups) {
    map.set(`${setup.type}:${setup.state}:${setup.direction}`, setup)
  }

  return [...map.values()]
}

function sortPeriods(a: DisplayPeriod, b: DisplayPeriod, mode: PeriodSort) {
  const aStart = new Date(a.startDate).getTime()
  const bStart = new Date(b.startDate).getTime()

  switch (mode) {
    case 'OLDEST':
      return aStart - bStart
    case 'LEADERS':
      return b.leaders.length - a.leaders.length || bStart - aStart
    case 'REVERSAL':
      return (
        scoreFamily(b.scorecard.REVERSAL) - scoreFamily(a.scorecard.REVERSAL) || bStart - aStart
      )
    case 'TREND':
      return (
        Math.max(
          scoreFamily(b.scorecard.TREND_LONG),
          scoreFamily(b.scorecard.TREND_SHORT),
        ) -
          Math.max(
            scoreFamily(a.scorecard.TREND_LONG),
            scoreFamily(a.scorecard.TREND_SHORT),
          ) || bStart - aStart
      )
    case 'NEWEST':
    default:
      return bStart - aStart
  }
}

function sortLeaders(a: DisplayLeader, b: DisplayLeader, mode: LeaderSort) {
  switch (mode) {
    case 'TICKER':
      return a.ticker.localeCompare(b.ticker)
    case 'STAGE':
      return stageRank(b.stageAtPeriodEnd) - stageRank(a.stageAtPeriodEnd)
    case 'SHORTABLE':
      return Number(b.shortingEnabled) - Number(a.shortingEnabled) || b.peakGainPct - a.peakGainPct
    case 'PEAK_GAIN':
    default:
      return b.peakGainPct - a.peakGainPct
  }
}

function buildSummary(periods: DisplayPeriod[]) {
  const leaders = new Map<string, DisplayLeader>()
  const regimeCounts = new Map<DisplayPeriod['labelRaw'], number>()

  let liveSamples = 0
  let simulatedSamples = 0

  for (const period of periods) {
    regimeCounts.set(period.labelRaw, (regimeCounts.get(period.labelRaw) ?? 0) + 1)
    liveSamples += period.liveSampleCount
    simulatedSamples += period.simulatedSampleCount

    for (const leader of period.leaders) {
      leaders.set(leader.ticker, leader)
    }
  }

  const dominantRegime =
    [...regimeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'TRANSITION'
  const leadingFamily = periods.length
    ? getDominantFamily(aggregateScorecards(periods.flatMap((period) => period.periods)))
    : null

  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  )

  return {
    periodCount: periods.length,
    rangeStart: sortedPeriods[0] ? shortDate(sortedPeriods[0].startDate) : 'N/A',
    rangeEnd: sortedPeriods[sortedPeriods.length - 1]
      ? shortDate(sortedPeriods[sortedPeriods.length - 1].endDate)
      : 'N/A',
    dominantRegime,
    dominantRegimeCount: regimeCounts.get(dominantRegime) ?? 0,
    uniqueLeaders: leaders.size,
    shortReadyLeaders: [...leaders.values()].filter((leader) => leader.shortingEnabled).length,
    leadingFamily,
    liveSamples,
    simulatedSamples,
  }
}

function getDominantFamily(scorecard: Record<SetupFamily, ApiMarketScoreMetric>) {
  const ranked = FAMILY_KEYS.map((family) => ({
    family,
    score: scoreFamily(scorecard[family]),
  })).sort((a, b) => b.score - a.score)

  return ranked[0]?.score > 0 ? ranked[0].family : null
}

function scoreFamily(metric: ApiMarketScoreMetric) {
  return metric.avgFinalR * 100 + metric.winRate * 10 + metric.count
}

function humanizeRegime(label: DisplayPeriod['labelRaw']) {
  switch (label) {
    case 'TREND_UP':
      return 'Trend Up'
    case 'TREND_DOWN':
      return 'Trend Down'
    case 'RANGE':
      return 'Range'
    case 'TRANSITION':
      return 'Transition'
    case 'MIXED':
    default:
      return 'Mixed'
  }
}

function humanizeFamily(family: SetupFamily) {
  switch (family) {
    case 'REVERSAL':
      return 'Reversal'
    case 'TREND_LONG':
      return 'Trend Long'
    case 'TREND_SHORT':
      return 'Trend Short'
  }
}

function humanizeTrend(trend: MarketTrendLabel) {
  switch (trend) {
    case 'UPTREND':
      return 'Uptrend'
    case 'DOWNTREND':
      return 'Downtrend'
    case 'RANGE':
      return 'Range'
    case 'TRANSITION':
    default:
      return 'Transition'
  }
}

function shortDate(date: string) {
  return LONG_DATE_FORMATTER.format(new Date(date))
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)

  if (startDate.toDateString() === endDate.toDateString()) {
    return LONG_DATE_FORMATTER.format(startDate)
  }

  if (
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth()
  ) {
    return `${SHORT_DATE_FORMATTER.format(startDate)} - ${endDate.getUTCDate()}, ${YEAR_FORMATTER.format(endDate)}`
  }

  if (startDate.getUTCFullYear() === endDate.getUTCFullYear()) {
    return `${SHORT_DATE_FORMATTER.format(startDate)} - ${LONG_DATE_FORMATTER.format(endDate)}`
  }

  return `${LONG_DATE_FORMATTER.format(startDate)} - ${LONG_DATE_FORMATTER.format(endDate)}`
}

function stageRank(stage: StageEnum | null) {
  switch (stage) {
    case 'STAGE_4':
      return 4
    case 'STAGE_3':
      return 3
    case 'STAGE_2':
      return 2
    case 'STAGE_1':
      return 1
    default:
      return 0
  }
}

function stageLabel(stage: StageEnum | null) {
  if (!stage) return 'N/A'
  return stage.replace('STAGE_', 'Stage ')
}

function getLeaderStatus(leader: DisplayLeader) {
  if (leader.identifiedSetupLabel) {
    return {
      label: leader.identifiedSetupLabel,
      tone:
        leader.shortingEnabled ||
        leader.primarySetup?.direction === 'SHORT' ||
        leader.stageAtPeriodEnd === 'STAGE_4'
          ? ('bearish' as const)
          : leader.primarySetup?.type === 'UNDERCUT_RALLY' ||
              leader.primarySetup?.type === 'DOUBLE_TOP'
            ? ('warning' as const)
            : ('accent' as const),
    }
  }

  const type = leader.primarySetup?.type

  if (type === 'DOUBLE_TOP' || type === 'FAIL_BREAKOUT' || type === 'FAIL_BASE') {
    return {
      label: leader.shortingEnabled ? 'Short setup' : 'Failing',
      tone: 'bearish' as const,
    }
  }

  if (type === 'UNDERCUT_RALLY') {
    return {
      label: 'Reversal in play',
      tone: 'warning' as const,
    }
  }

  if (type === 'PULLBACK_BUY' || type === 'EMA20_PULLBACK' || type === 'MA_TOUCH') {
    return {
      label: 'Pullback',
      tone: 'accent' as const,
    }
  }

  if (
    type === 'VCP' ||
    type === 'BREAKOUT_PIVOT' ||
    type === 'BREAKOUT_VCB' ||
    type === 'BREAKOUT_WEDGE' ||
    type === 'HIGH_TIGHT_FLAG'
  ) {
    return {
      label: 'Setting up',
      tone: 'bullish' as const,
    }
  }

  if (leader.stageAtPeriodEnd === 'STAGE_2') {
    return {
      label: 'Stage 2 run',
      tone: 'bullish' as const,
    }
  }

  if (leader.stageAtPeriodEnd === 'STAGE_3') {
    return {
      label: leader.shortingEnabled ? 'Basing / top watch' : 'Basing',
      tone: 'warning' as const,
    }
  }

  if (leader.stageAtPeriodEnd === 'STAGE_4') {
    return {
      label: leader.shortingEnabled ? 'Declining / shortable' : 'Declining',
      tone: 'bearish' as const,
    }
  }

  return {
    label: 'Quiet / no move',
    tone: 'muted' as const,
  }
}

function SummaryCard({
  label,
  value,
  detail,
  tone = 'muted',
}: {
  label: string
  value: string
  detail: string
  tone?: 'accent' | 'bullish' | 'bearish' | 'warning' | 'muted'
}) {
  const toneClasses =
    tone === 'bullish'
      ? 'border-bullish/20 bg-bullish/8'
      : tone === 'bearish'
        ? 'border-bearish/20 bg-bearish/8'
        : tone === 'warning'
          ? 'border-amber-400/20 bg-amber-400/8'
          : tone === 'accent'
            ? 'border-accent/20 bg-accent/8'
            : 'border-border-default bg-bg-surface'

  const iconClass =
    tone === 'bearish'
      ? 'text-bearish'
      : tone === 'warning'
        ? 'text-amber-300'
        : tone === 'bullish'
          ? 'text-bullish'
          : tone === 'accent'
            ? 'text-accent'
            : 'text-text-muted'

  return (
    <div className={cn('rounded-2xl border p-4 sm:p-5', toneClasses)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted sm:text-xs">
            {label}
          </div>
          <div className="font-heading text-2xl font-semibold text-text-primary sm:text-[1.7rem]">
            {value}
          </div>
          <div className="text-xs text-text-secondary">{detail}</div>
        </div>
        {tone === 'bearish' ? (
          <ArrowDownRight className={cn('h-5 w-5 shrink-0', iconClass)} />
        ) : (
          <ArrowUpRight className={cn('h-5 w-5 shrink-0', iconClass)} />
        )}
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted sm:text-xs">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full cursor-pointer rounded-xl border border-border-default bg-bg-elevated px-3 py-2.5 text-sm text-text-primary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function RegimeBadge({
  label,
  compact = false,
}: {
  label: DisplayPeriod['labelRaw']
  compact?: boolean
}) {
  const classes =
    label === 'TREND_UP'
      ? 'bg-bullish/12 text-bullish'
      : label === 'TREND_DOWN'
        ? 'bg-bearish/12 text-bearish'
        : label === 'RANGE'
          ? 'bg-amber-400/12 text-amber-300'
          : label === 'TRANSITION'
            ? 'bg-accent/12 text-accent'
            : 'bg-bg-overlay text-text-secondary'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[10px] sm:text-xs',
        classes,
      )}
    >
      {humanizeRegime(label)}
    </span>
  )
}

function ProxyChip({
  proxy,
  compact = false,
}: {
  proxy: ApiMarketProxyState
  compact?: boolean
}) {
  const trendClasses =
    proxy.trend === 'UPTREND'
      ? 'border-bullish/20 bg-bullish/8'
      : proxy.trend === 'DOWNTREND'
        ? 'border-bearish/20 bg-bearish/8'
        : proxy.trend === 'RANGE'
          ? 'border-amber-400/20 bg-amber-400/8'
          : 'border-border-default bg-bg-overlay'

  return (
    <div
      className={cn(
        'rounded-xl border px-2.5 py-2',
        compact ? 'min-w-[96px]' : 'min-w-[112px]',
        trendClasses,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-text-primary sm:text-xs">
          {proxy.ticker}
        </span>
        <span className="text-[10px] text-text-muted">{stageLabel(proxy.stage)}</span>
      </div>
      <div className="mt-1 text-[10px] text-text-secondary sm:text-xs">
        {humanizeTrend(proxy.trend)}
      </div>
      {!compact ? (
        <div className="mt-1 text-[10px] text-text-muted">
          {proxy.dominantSetup ? proxy.dominantSetup.replaceAll('_', ' ') : 'No setup'}
        </div>
      ) : null}
    </div>
  )
}

function FamilyScorePill({
  family,
  metric,
  active,
}: {
  family: SetupFamily
  metric: ApiMarketScoreMetric
  active?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border px-3 py-2',
        active ? 'border-accent/30 bg-accent/10' : 'border-border-default bg-bg-elevated',
      )}
    >
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          {humanizeFamily(family)}
        </div>
        <div className="text-xs text-text-secondary">
          {metric.count} samples / {Math.round(metric.winRate)}% win
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-semibold text-text-primary">
          {metric.avgFinalR >= 0 ? '+' : ''}
          {metric.avgFinalR.toFixed(2)}R
        </div>
        <div className="text-[10px] text-text-muted">{metric.source}</div>
      </div>
    </div>
  )
}

function MetricCard({
  family,
  metric,
}: {
  family: SetupFamily
  metric: ApiMarketScoreMetric
}) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-elevated p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">
        {humanizeFamily(family)}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="font-mono text-lg font-semibold text-text-primary">
          {metric.avgFinalR >= 0 ? '+' : ''}
          {metric.avgFinalR.toFixed(2)}R
        </div>
        <div className="text-right text-[10px] text-text-muted">
          <div>{metric.count} setups</div>
          <div>{Math.round(metric.winRate)}% win</div>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ leader }: { leader: DisplayLeader }) {
  const status = getLeaderStatus(leader)
  const classes =
    status.tone === 'bullish'
      ? 'bg-bullish/12 text-bullish'
      : status.tone === 'bearish'
        ? 'bg-bearish/12 text-bearish'
        : status.tone === 'warning'
          ? 'bg-amber-400/12 text-amber-300'
          : status.tone === 'accent'
            ? 'bg-accent/12 text-accent'
            : 'bg-bg-elevated text-text-muted'

  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs', classes)}>
      {status.label}
    </span>
  )
}

function StagePill({
  stage,
  compact = false,
}: {
  stage: StageEnum | null
  compact?: boolean
}) {
  const classes =
    stage === 'STAGE_2'
      ? 'bg-bullish/12 text-bullish'
      : stage === 'STAGE_3'
        ? 'bg-amber-400/12 text-amber-300'
        : stage === 'STAGE_4'
          ? 'bg-bearish/12 text-bearish'
          : 'bg-bg-elevated text-text-secondary'

  return (
    <span
      className={cn(
        'inline-flex rounded-full font-semibold',
        compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[10px] sm:text-xs',
        classes,
      )}
    >
      {stageLabel(stage)}
    </span>
  )
}

function MiniMetric({
  label,
  value,
  tone = 'muted',
}: {
  label: string
  value: string
  tone?: 'bullish' | 'bearish' | 'accent' | 'muted'
}) {
  const valueClass =
    tone === 'bullish'
      ? 'text-bullish'
      : tone === 'bearish'
        ? 'text-bearish'
        : tone === 'accent'
          ? 'text-accent'
          : 'text-text-primary'

  return (
    <div className="rounded-lg border border-border-default bg-bg-overlay px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className={cn('mt-1 font-mono text-sm font-semibold', valueClass)}>{value}</div>
    </div>
  )
}
