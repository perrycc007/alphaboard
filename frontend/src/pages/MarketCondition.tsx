import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, GitCompareArrows, Loader2, RefreshCw } from 'lucide-react'
import {
  fetchMarketCondition,
  rebuildMarketCondition,
  type MarketConditionSnapshot,
} from '@/lib/api/research'

type TrendState = 'UP' | 'DOWN' | 'RANGE'

interface TrendDetail {
  longTerm?: TrendLeg
  midTerm?: TrendLeg
  shortTerm?: TrendLeg
}

interface TrendLeg {
  state?: TrendState
  scoreContribution?: number
  extended?: boolean
  pullback?: boolean
  oversold?: boolean
}

interface StructureSummary {
  trend?: string
  reason?: string
  higherLow?: boolean
  lowerHigh?: boolean
  risingTrendline?: boolean
  fallingTrendline?: boolean
  trendline?: { slope?: number; currentPosition?: string } | null
}

interface BreadthStructure {
  latest?: {
    naad?: number | null
    nahl?: number | null
    naa50r?: number | null
    naa200r?: number | null
  }
  naad?: StructureSummary
  nahlState?: string
  naa50rState?: string
  naa200rState?: string
  indexNaadDivergence?: string
  equalWeightDivergence?: string
  interpretation?: string
}

interface EqualWeightStructure {
  pairs?: Array<{
    cap: string
    equal: string
    divergence: string
    capStructure?: StructureSummary
    equalStructure?: StructureSummary
    naadStructure?: StructureSummary
  }>
  primaryDivergence?: string
}

interface SetupPerformance {
  windowDays?: number
  sampleCount?: number
  sourceCounts?: SetupPerformanceSourceCounts
  periods?: Array<{
    key: string
    label: string
    startDate: string
    endDate: string
    sampleCount: number
    sourceCounts?: SetupPerformanceSourceCounts
    groups?: SetupPerformanceGroup[]
    outcomeDistribution: DistributionBin[]
  }>
  groups?: SetupPerformanceGroup[]
}

interface SetupPerformanceSourceCounts {
  live: number
  simulated: number
  total: number
}

interface SetupPerformanceGroup {
  key: string
  family: string
  setupType: string
  direction: string
  sampleCount: number
  sourceCounts?: SetupPerformanceSourceCounts
  stopLossRate: number | null
  targets: Array<{
    targetR: number
    sampleCount: number
    hits: number
    winRate: number | null
    averageHoldingDays: number | null
    medianHoldingDays: number | null
    percentGainDistribution: DistributionBin[]
  }>
  outcomeDistribution: DistributionBin[]
  maxRDistribution: DistributionBin[]
}

interface DistributionBin {
  label: string
  count: number
  pct: number
}

export default function MarketCondition() {
  const [snapshots, setSnapshots] = useState<MarketConditionSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSnapshots(await fetchMarketCondition())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const primary = useMemo(
    () => snapshots.find((snap) => snap.scopeType === 'INDEX' && snap.scopeKey === 'QQQ') ?? snapshots[0],
    [snapshots],
  )

  const handleRebuild = async () => {
    setBusy(true)
    setError(null)
    try {
      await rebuildMarketCondition()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rebuild failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Activity className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            Market Condition
          </h1>
        </div>
        <button
          onClick={handleRebuild}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 cursor-pointer sm:px-4 sm:py-2 sm:text-sm"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" /> : <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          Rebuild
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-bearish/30 bg-bearish/10 px-3 py-2 text-xs text-bearish sm:text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : snapshots.length === 0 || !primary ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border-default bg-bg-surface">
          <span className="text-xs text-text-muted sm:text-sm">
            No snapshots yet. Click Rebuild to compute the latest market condition.
          </span>
        </div>
      ) : (
        <MarketConditionBody snapshots={snapshots} primary={primary} />
      )}
    </div>
  )
}

function MarketConditionBody({
  snapshots,
  primary,
}: {
  snapshots: MarketConditionSnapshot[]
  primary: MarketConditionSnapshot
}) {
  const trend = asObject<TrendDetail>(primary.trendDetailJson)
  const breadth = asObject<BreadthStructure>(primary.breadthStructureJson)
  const equalWeight = asObject<EqualWeightStructure>(primary.equalWeightStructureJson)
  const setupPerformance = asObject<SetupPerformance>(primary.setupPerformanceJson)

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <TrendCard label="Long Term" detail={trend.longTerm} fallback={legacyTrend(primary, 'long')} />
        <TrendCard label="Mid Term" detail={trend.midTerm} fallback={legacyTrend(primary, 'mid')} />
        <TrendCard label="Short Term" detail={trend.shortTerm} fallback={legacyTrend(primary, 'short')} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <BreadthPanel breadth={breadth} />
        <EqualWeightPanel equalWeight={equalWeight} />
      </div>

      <SetupPerformancePanel setupPerformance={setupPerformance} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {snapshots.map((snap) => (
          <div key={snap.id} className="rounded-lg border border-border-default bg-bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-heading text-sm font-bold text-text-primary">{snap.scopeKey}</span>
              <StatusPill label={snap.scopeType.replace(/_/g, ' ')} tone="neutral" />
            </div>
            <div className="mt-2 text-xs text-text-muted">{snap.summary ?? 'No summary'}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function TrendCard({
  label,
  detail,
  fallback,
}: {
  label: string
  detail?: TrendLeg
  fallback: TrendState
}) {
  const state = detail?.state ?? fallback
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase text-text-muted">{label}</span>
        <StatusPill label={state} tone={state === 'UP' ? 'bull' : state === 'DOWN' ? 'bear' : 'neutral'} />
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold text-text-primary">
        {signed(detail?.scoreContribution ?? 0)}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {detail?.pullback && <StatusPill label="Pullback" tone="bull" />}
        {detail?.extended && <StatusPill label="Extended" tone="warn" />}
        {detail?.oversold && <StatusPill label="Oversold" tone="warn" />}
      </div>
    </section>
  )
}

function BreadthPanel({ breadth }: { breadth: BreadthStructure }) {
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-accent" />
        <h2 className="font-heading text-sm font-semibold text-text-primary">Breadth Structure</h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label="NAA50R" value={formatNum(breadth.latest?.naa50r, '%')} />
        <Metric label="NAA200R" value={formatNum(breadth.latest?.naa200r, '%')} />
        <Metric label="NAHL" value={formatNum(breadth.latest?.nahl)} />
        <Metric label="NAAD" value={formatNum(breadth.latest?.naad)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusPill label={`NAHL ${breadth.nahlState ?? 'UNKNOWN'}`} tone={breadth.nahlState === 'NEGATIVE' ? 'bear' : breadth.nahlState === 'POSITIVE' ? 'bull' : 'neutral'} />
        <StatusPill label={`NAAD ${breadth.naad?.trend ?? 'UNKNOWN'}`} tone={trendTone(breadth.naad?.trend)} />
        <StatusPill label={breadth.indexNaadDivergence ?? 'UNKNOWN'} tone={divergenceTone(breadth.indexNaadDivergence)} />
      </div>
      <p className="mt-3 text-xs leading-5 text-text-muted">{breadth.interpretation ?? 'Breadth structure unavailable.'}</p>
    </section>
  )
}

function EqualWeightPanel({ equalWeight }: { equalWeight: EqualWeightStructure }) {
  const pairs = equalWeight.pairs ?? []
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-accent" />
        <h2 className="font-heading text-sm font-semibold text-text-primary">Equal Weight Divergence</h2>
      </div>
      <div className="mt-3 space-y-2">
        {pairs.length === 0 ? (
          <div className="text-xs text-text-muted">No equal-weight pair for this snapshot.</div>
        ) : (
          pairs.map((pair) => (
            <div key={`${pair.cap}-${pair.equal}`} className="rounded-md border border-border-muted p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-text-primary">
                  {pair.cap}/{pair.equal}
                </span>
                <StatusPill label={pair.divergence} tone={divergenceTone(pair.divergence)} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-text-muted">
                <span>Cap: {pair.capStructure?.trend ?? 'UNKNOWN'}</span>
                <span>Equal: {pair.equalStructure?.trend ?? 'UNKNOWN'}</span>
                <span>NAAD: {pair.naadStructure?.trend ?? 'UNKNOWN'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function SetupPerformancePanel({ setupPerformance }: { setupPerformance: SetupPerformance }) {
  const groups = (setupPerformance.groups ?? []).slice(0, 6)
  const periods = (setupPerformance.periods ?? []).slice(0, 8)
  const periodSetupRows = periods
    .flatMap((period) =>
      (period.groups ?? []).slice(0, 3).map((group) => ({ period, group })),
    )
    .slice(0, 24)
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold text-text-primary">Setup Performance</h2>
        <span className="text-xs text-text-muted">
          {setupPerformance.sampleCount ?? 0} setup outcomes / {setupPerformance.windowDays ?? 60} days
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-text-muted">
        Target hits are cumulative thresholds. Outcome mix is exclusive, so its buckets add up to 100%.
        {setupPerformance.sourceCounts
          ? ` ${formatSourceCounts(setupPerformance.sourceCounts)}.`
          : ''}
      </p>

      {periods.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-text-muted">
              <tr className="border-b border-border-muted">
                <th className="py-2 pr-3 font-medium">Week</th>
                <th className="py-2 pr-3 font-medium">Outcomes</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Outcome Mix</th>
                {['Stop', '<2R', '2-3R', '3-4R', '4R+'].map((label) => (
                  <th key={label} className="py-2 pr-3 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.key} className="border-b border-border-muted/50">
                  <td className="py-2 pr-3 font-mono text-text-primary">
                    {period.startDate}
                    <span className="text-text-muted"> to {period.endDate}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-text-secondary">{period.sampleCount}</td>
                  <td className="py-2 pr-3 font-mono text-text-secondary">
                    {formatSourceCounts(period.sourceCounts)}
                  </td>
                  <td className="py-2 pr-3">
                    <Distribution bars={period.outcomeDistribution} />
                  </td>
                  {period.outcomeDistribution.map((bin) => (
                    <td key={bin.label} className="py-2 pr-3 font-mono text-text-secondary">
                      {pct(bin.pct)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {periodSetupRows.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <div className="mb-2 text-xs font-medium uppercase text-text-muted">Setup Success by Week</div>
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="text-text-muted">
              <tr className="border-b border-border-muted">
                <th className="py-2 pr-3 font-medium">Week</th>
                <th className="py-2 pr-3 font-medium">Setup</th>
                <th className="py-2 pr-3 font-medium">Dir</th>
                <th className="py-2 pr-3 font-medium">Outcomes</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Stop</th>
                {[2, 3, 4].map((target) => (
                  <th key={target} className="py-2 pr-3 font-medium">{target}R+ Hit</th>
                ))}
                <th className="py-2 pr-3 font-medium">Outcome Mix</th>
              </tr>
            </thead>
            <tbody>
              {periodSetupRows.map(({ period, group }) => (
                <tr key={`${period.key}:${group.key}`} className="border-b border-border-muted/50 align-top">
                  <td className="py-2 pr-3 font-mono text-text-primary">{period.startDate}</td>
                  <td className="py-2 pr-3 text-text-primary">{group.setupType.replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-3">
                    <StatusPill label={group.direction} tone={group.direction === 'SHORT' ? 'bear' : 'bull'} />
                  </td>
                  <td className="py-2 pr-3 font-mono text-text-secondary">{group.sampleCount}</td>
                  <td className="py-2 pr-3 font-mono text-text-secondary">
                    {formatSourceCounts(group.sourceCounts)}
                  </td>
                  <td className="py-2 pr-3 font-mono text-bearish">{pct(group.stopLossRate)}</td>
                  {group.targets.map((target) => (
                    <td key={target.targetR} className="py-2 pr-3 font-mono text-text-primary">
                      {pct(target.winRate)}
                    </td>
                  ))}
                  <td className="py-2 pr-3">
                    <Distribution bars={group.outcomeDistribution ?? group.maxRDistribution} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[840px] text-left text-xs">
          <thead className="text-text-muted">
            <tr className="border-b border-border-muted">
              <th className="py-2 pr-3 font-medium">Setup</th>
              <th className="py-2 pr-3 font-medium">Dir</th>
              <th className="py-2 pr-3 font-medium">Outcomes</th>
              <th className="py-2 pr-3 font-medium">Source</th>
              <th className="py-2 pr-3 font-medium">Stop</th>
              {[2, 3, 4].map((target) => (
                <th key={target} className="py-2 pr-3 font-medium">{target}R+ Hit</th>
              ))}
              <th className="py-2 pr-3 font-medium">Outcome Mix</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.key} className="border-b border-border-muted/50 align-top">
                <td className="py-2 pr-3 text-text-primary">{group.setupType.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-3"><StatusPill label={group.direction} tone={group.direction === 'SHORT' ? 'bear' : 'bull'} /></td>
                <td className="py-2 pr-3 font-mono text-text-secondary">{group.sampleCount}</td>
                <td className="py-2 pr-3 font-mono text-text-secondary">
                  {formatSourceCounts(group.sourceCounts)}
                </td>
                <td className="py-2 pr-3 font-mono text-bearish">{pct(group.stopLossRate)}</td>
                {group.targets.map((target) => (
                  <td key={target.targetR} className="py-2 pr-3">
                    <div className="font-mono text-text-primary">{pct(target.winRate)}</div>
                    <div className="text-[10px] text-text-muted">
                      med {target.medianHoldingDays ?? '-'}d
                    </div>
                  </td>
                ))}
                <td className="py-2 pr-3">
                  <Distribution bars={group.outcomeDistribution ?? group.maxRDistribution} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {groups.length === 0 && <div className="mt-3 text-xs text-text-muted">No recent setup outcomes yet.</div>}
    </section>
  )
}

function Distribution({ bars }: { bars: DistributionBin[] }) {
  return (
    <div className="flex h-7 min-w-32 overflow-hidden rounded border border-border-muted">
      {bars.map((bin) => (
        <div
          key={bin.label}
          className={distributionColor(bin.label)}
          style={{ width: `${Math.max(bin.pct * 100, bin.count > 0 ? 4 : 0)}%` }}
          title={`${bin.label}: ${bin.count} (${pct(bin.pct)})`}
        />
      ))}
    </div>
  )
}

function distributionColor(label: string) {
  if (label === 'Stop' || label === '<0R') return 'bg-bearish/75'
  if (label === '<2R' || label === '0-1R' || label === '1-2R') return 'bg-warning/75'
  if (label === '2-3R') return 'bg-accent/70'
  if (label === '3-4R') return 'bg-bullish/70'
  if (label === '4R+') return 'bg-bullish'
  return 'bg-accent/70'
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-muted px-2 py-1">
      <div className="text-[10px] uppercase text-text-muted">{label}</div>
      <div className="font-mono text-sm text-text-primary">{value}</div>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'bull' | 'bear' | 'warn' | 'neutral' }) {
  const color =
    tone === 'bull'
      ? 'bg-bullish/10 text-bullish'
      : tone === 'bear'
        ? 'bg-bearish/10 text-bearish'
        : tone === 'warn'
          ? 'bg-warning/10 text-warning'
          : 'bg-secondary text-text-secondary'
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${color}`}>{label}</span>
}

function asObject<T>(value: unknown): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : ({} as T)
}

function legacyTrend(snap: MarketConditionSnapshot, leg: 'long' | 'mid' | 'short'): TrendState {
  if (leg === 'long') {
    if (snap.longTermTrendingUp) return 'UP'
    if (snap.longTermTrendingDown) return 'DOWN'
    return 'RANGE'
  }
  if (leg === 'mid') return snap.midTermPullback ? 'UP' : 'RANGE'
  return snap.shortTermOversold ? 'DOWN' : 'RANGE'
}

function trendTone(trend?: string): 'bull' | 'bear' | 'neutral' {
  if (trend === 'UPTREND') return 'bull'
  if (trend === 'DOWNTREND') return 'bear'
  return 'neutral'
}

function divergenceTone(value?: string): 'bull' | 'bear' | 'neutral' | 'warn' {
  if (value?.includes('BULLISH')) return 'bull'
  if (value?.includes('BEARISH')) return 'bear'
  if (value === 'MIXED') return 'warn'
  return 'neutral'
}

function formatNum(value: number | null | undefined, suffix = '') {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : '-'
}

function formatSourceCounts(value: SetupPerformanceSourceCounts | null | undefined) {
  if (!value) return '-'
  return `live ${value.live} / sim ${value.simulated}`
}

function signed(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function pct(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '-'
}
