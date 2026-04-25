import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, AlertCircle, Clock, BarChart2, Filter } from 'lucide-react'
import { useSlidePanelStore } from '@/stores/useSlidePanelStore'
import { useStockDetailStore } from '@/stores/useStockDetailStore'
import { useSetupStore } from '@/stores/useSetupStore'
import { parseStageToNumber } from '@/types'
import type { ApiBarEvidence, ApiSetup, ApiStageHistory, SetupType } from '@/types'
import { StageTag, SetupTypeBadge, DirectionBadge, LoadingSkeleton, SkeletonGroup } from '@/components/shared'
import { StockChart } from '@/components/StockChart'
import { cn, formatPrice, formatCompactNumber, formatPercent } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export function SlidePanel() {
  const open = useSlidePanelStore((s) => s.open)
  const ticker = useSlidePanelStore((s) => s.ticker)
  const closePanel = useSlidePanelStore((s) => s.closePanel)

  const stock = useStockDetailStore((s) => s.stock)
  const dailyBars = useStockDetailStore((s) => s.dailyBars)
  const spyBars = useStockDetailStore((s) => s.spyBars)
  const evidence = useStockDetailStore((s) => s.evidence)
  const stageHistory = useStockDetailStore((s) => s.stageHistory)
  const loading = useStockDetailStore((s) => s.loading)
  const error = useStockDetailStore((s) => s.error)
  const fetchStockDetail = useStockDetailStore((s) => s.fetchStockDetail)
  const clear = useStockDetailStore((s) => s.clear)

  useEffect(() => {
    if (ticker) {
      fetchStockDetail(ticker)
    }
    return () => clear()
  }, [ticker, fetchStockDetail, clear])

  const getSetupsForTicker = useSetupStore((s) => s.getSetupsForTicker)
  const rawTickerSetups = useMemo(() => (ticker ? getSetupsForTicker(ticker) : []), [ticker, getSetupsForTicker])

  const [hiddenSetupTypes, setHiddenSetupTypes] = useState<Set<SetupType>>(new Set())

  const deduplicatedSetups = useMemo(() => {
    if (rawTickerSetups.length === 0 || dailyBars.length === 0) return []

    const groups = new Map<string, ApiSetup[]>()
    for (const setup of rawTickerSetups) {
      if (setup.pivotPrice == null) continue
      const key = `${setup.type}:${Math.round(setup.pivotPrice * 1000) / 1000}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(setup)
    }

    const result: ApiSetup[] = []
    for (const group of groups.values()) {
      if (group.length === 1) {
        result.push(group[0])
        continue
      }

      const setupsWithBars = group
        .map((setup) => {
          const detectedDate = setup.detectedAt.slice(0, 10)
          const bar = dailyBars.find((b) => b.date.slice(0, 10) === detectedDate)
          return { setup, bar }
        })
        .filter((item) => item.bar != null)

      if (setupsWithBars.length === 0) {
        result.push(group[0])
        continue
      }

      const firstSetup = setupsWithBars[0].setup
      if (firstSetup.direction === 'SHORT') {
        const best = setupsWithBars.reduce((best, current) =>
          current.bar!.low < best.bar!.low ? current : best,
        )
        result.push(best.setup)
      } else {
        const best = setupsWithBars.reduce((best, current) =>
          current.bar!.high > best.bar!.high ? current : best,
        )
        result.push(best.setup)
      }
    }

    return result
  }, [rawTickerSetups, dailyBars])

  const filteredSetups = useMemo(() => {
    return deduplicatedSetups.filter((setup) => !hiddenSetupTypes.has(setup.type))
  }, [deduplicatedSetups, hiddenSetupTypes])

  const availableSetupTypes = useMemo(() => {
    const types = new Set<SetupType>()
    for (const setup of deduplicatedSetups) {
      types.add(setup.type)
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

  const latestBar = dailyBars.length > 0 ? dailyBars[0] : null
  const latestStage = stock?.stages?.[0]
  const price = latestBar?.close
  const prevClose = dailyBars.length > 1 ? dailyBars[1]?.close : latestBar?.open
  const changePercent =
    price != null && prevClose != null ? ((price - prevClose) / prevClose) * 100 : null

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closePanel()
      }}
    >
      <SheetContent
        side="right"
        className="w-full max-w-none border-border bg-card p-0 sm:max-w-[480px] lg:max-w-[560px]"
      >
        <SheetHeader className="gap-2 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="pr-10">
            <SheetTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
              {ticker ?? 'Stock Detail'}
              {latestStage ? <StageTag stage={latestStage.stage} /> : null}
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs sm:text-sm">
              {stock?.name ?? (ticker ? `Detail view for ${ticker}` : 'Select a stock to view details')}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {!ticker ? (
              <div className="flex h-full items-center justify-center text-xs text-text-muted sm:text-sm">
                Select a stock to view details
              </div>
            ) : loading ? (
              <div className="space-y-4">
                <LoadingSkeleton className="h-64 rounded-lg" />
                <SkeletonGroup count={4}>
                  <LoadingSkeleton className="h-20 rounded-lg" />
                </SkeletonGroup>
              </div>
            ) : error ? (
              <Card className="border-bearish/30 bg-bearish/5 text-bearish">
                <CardContent className="p-4 text-sm">Failed to load: {error}</CardContent>
              </Card>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {price != null ? (
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-2xl font-bold text-text-primary sm:text-3xl">
                      ${formatPrice(price)}
                    </span>
                    {changePercent != null ? (
                      <span
                        className={cn(
                          'font-mono text-sm font-semibold sm:text-base',
                          changePercent >= 0 ? 'text-bullish' : 'text-bearish',
                        )}
                      >
                        {formatPercent(changePercent)}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {availableSetupTypes.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-text-muted" />
                    {availableSetupTypes.map((type) => (
                      <Button
                        key={type}
                        variant={hiddenSetupTypes.has(type) ? 'ghost' : 'secondary'}
                        size="sm"
                        onClick={() => toggleSetupType(type)}
                        className={cn(
                          'h-7 rounded-full px-2 text-[10px] sm:text-xs',
                          hiddenSetupTypes.has(type) && 'opacity-50 line-through',
                        )}
                      >
                        {type.replace(/_/g, ' ')}
                      </Button>
                    ))}
                  </div>
                ) : null}

                <StockChart
                  dailyBars={dailyBars}
                  spyBars={spyBars}
                  setups={filteredSetups}
                  height={300}
                  priority
                />

                {filteredSetups.length > 0 ? (
                  <Section title="Active Setups" icon={<TrendingUp className="h-3.5 w-3.5" />}>
                    <div className="space-y-2">
                      {filteredSetups.map((setup) => (
                        <SetupCard key={setup.id} setup={setup} />
                      ))}
                    </div>
                  </Section>
                ) : null}

                {evidence.length > 0 ? (
                  <Section
                    title="Confirmation / Violation"
                    icon={<AlertCircle className="h-3.5 w-3.5" />}
                  >
                    <div className="space-y-1.5">
                      {evidence.slice(0, 15).map((ev) => (
                        <EvidenceRow key={ev.id} evidence={ev} />
                      ))}
                    </div>
                  </Section>
                ) : null}

                {stageHistory.length > 0 ? (
                  <Section title="Stage History" icon={<Clock className="h-3.5 w-3.5" />}>
                    <div className="space-y-1.5">
                      {stageHistory.slice(0, 10).map((sh) => (
                        <StageHistoryRow key={sh.id} entry={sh} />
                      ))}
                    </div>
                  </Section>
                ) : null}

                {filteredSetups.length > 0 || latestBar ? (
                  <Section title="Key Levels" icon={<BarChart2 className="h-3.5 w-3.5" />}>
                    <KeyLevels setups={filteredSetups} latestBar={latestBar} />
                  </Section>
                ) : null}

                {stock ? (
                  <Section title="Fundamentals" icon={<BarChart2 className="h-3.5 w-3.5" />}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <FundamentalItem label="Sector" value={stock.sector ?? '-'} />
                      <FundamentalItem label="Industry" value={stock.industry ?? '-'} />
                      <FundamentalItem label="Exchange" value={stock.exchange ?? '-'} />
                      <FundamentalItem
                        label="Market Cap"
                        value={stock.marketCap != null ? formatCompactNumber(stock.marketCap) : '-'}
                      />
                      <FundamentalItem
                        label="Avg Volume"
                        value={stock.avgVolume != null ? formatCompactNumber(stock.avgVolume) : '-'}
                      />
                      <FundamentalItem
                        label="RS Rank"
                        value={latestBar?.rsRank != null ? String(latestBar.rsRank) : '-'}
                      />
                    </div>
                  </Section>
                ) : null}
              </div>
            )}
          </div>

          {ticker ? (
            <div className="flex items-center gap-2 border-t border-border px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
              <Button className="flex-1">Add to Watchlist</Button>
              <Button variant="outline" className="flex-1">
                Configure Alerts
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-bullish/30 bg-bullish/10 text-bullish hover:bg-bullish/20 hover:text-bullish"
              >
                Trade Idea
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-center gap-1.5 text-text-secondary">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wider sm:text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function SetupCard({ setup }: { setup: ApiSetup }) {
  return (
    <Card className="border-border-muted bg-secondary/60">
      <CardContent className="flex items-center justify-between p-2.5 sm:p-3">
        <div className="flex items-center gap-2">
          <SetupTypeBadge type={setup.type} />
          <DirectionBadge direction={setup.direction} />
          <Badge variant="secondary" className="text-[10px] text-text-muted sm:text-xs">
            {setup.state}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-right">
          {setup.pivotPrice != null ? (
            <div>
              <div className="text-[10px] text-text-muted">Pivot</div>
              <div className="font-mono text-xs text-text-primary">
                ${formatPrice(setup.pivotPrice)}
              </div>
            </div>
          ) : null}
          {setup.riskReward != null ? (
            <div>
              <div className="text-[10px] text-text-muted">R:R</div>
              <div className="font-mono text-xs text-accent">
                {Number(setup.riskReward).toFixed(1)}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function EvidenceRow({ evidence }: { evidence: ApiBarEvidence }) {
  const date = evidence.barDate.slice(0, 10)

  return (
    <Card className="border-transparent bg-secondary/40 shadow-none">
      <CardContent className="flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              evidence.isViolation
                ? 'bg-bearish'
                : evidence.bias === 'BULLISH'
                  ? 'bg-bullish'
                  : 'bg-bearish',
            )}
          />
          <span className="text-[10px] font-medium text-text-primary sm:text-xs">
            {evidence.pattern.replace(/_/g, ' ')}
          </span>
          {evidence.isViolation ? (
            <Badge className="px-1 py-0.5 text-[9px] font-medium text-bearish">VIOLATION</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-right">
          <span className="font-mono text-[10px] text-text-muted sm:text-xs">{date}</span>
          <span className="font-mono text-[10px] text-text-secondary sm:text-xs">
            ${formatPrice(evidence.keyLevelPrice)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function StageHistoryRow({ entry }: { entry: ApiStageHistory }) {
  const date = entry.date.slice(0, 10)
  const num = parseStageToNumber(entry.stage)

  return (
    <Card className="border-transparent bg-secondary/40 shadow-none">
      <CardContent className="flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2">
          <StageTag stage={num} />
          <Badge variant="secondary" className="text-[10px] text-text-muted">
            {entry.category}
          </Badge>
        </div>
        <span className="font-mono text-[10px] text-text-muted sm:text-xs">{date}</span>
      </CardContent>
    </Card>
  )
}

function KeyLevels({
  setups,
  latestBar,
}: {
  setups: ApiSetup[]
  latestBar: import('@/types').ApiStockDaily | null
}) {
  const levels: { label: string; price: number; color: string }[] = []

  for (const setup of setups) {
    if (setup.pivotPrice != null) {
      levels.push({ label: `Pivot (${setup.type})`, price: setup.pivotPrice, color: 'text-accent' })
    }
    if (setup.stopPrice != null) {
      levels.push({ label: 'Stop', price: setup.stopPrice, color: 'text-bearish' })
    }
    if (setup.targetPrice != null) {
      levels.push({ label: 'Target', price: setup.targetPrice, color: 'text-bullish' })
    }
  }

  if (latestBar) {
    if (latestBar.sma50 != null) levels.push({ label: 'SMA 50', price: latestBar.sma50, color: 'text-blue-400' })
    if (latestBar.sma200 != null) levels.push({ label: 'SMA 200', price: latestBar.sma200, color: 'text-red-400' })
  }

  if (levels.length === 0) return <span className="text-xs text-text-muted">No key levels</span>

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {levels.map((lvl, i) => (
        <Card key={`${lvl.label}-${i}`} className="border-transparent bg-secondary/60 shadow-none">
          <CardContent className="p-2">
            <div className="text-[10px] text-text-muted">{lvl.label}</div>
            <div className={cn('font-mono text-xs font-semibold', lvl.color)}>
              ${formatPrice(lvl.price)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function FundamentalItem({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-transparent bg-secondary/60 shadow-none">
      <CardContent className="p-2">
        <div className="text-[10px] text-text-muted">{label}</div>
        <div className="text-xs font-medium text-text-primary sm:text-sm">{value}</div>
      </CardContent>
    </Card>
  )
}
