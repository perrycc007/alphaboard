import { useEffect, useRef, useMemo } from 'react'
import { X, TrendingUp, TrendingDown, AlertCircle, Clock, BarChart2 } from 'lucide-react'
import { useSlidePanelStore } from '@/stores/useSlidePanelStore'
import { useStockDetailStore } from '@/stores/useStockDetailStore'
import { useSetupStore } from '@/stores/useSetupStore'
import { parseStageToNumber } from '@/types'
import type { ApiBarEvidence, ApiSetup, ApiStageHistory } from '@/types'
import { StageTag, SetupTypeBadge, DirectionBadge, LoadingSkeleton, SkeletonGroup } from '@/components/shared'
import { StockChart } from '@/components/StockChart'
import { cn, formatPrice, formatCompactNumber, formatPercent } from '@/lib/utils'

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

  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch stock detail when ticker changes
  useEffect(() => {
    if (ticker) {
      fetchStockDetail(ticker)
    }
    return () => clear()
  }, [ticker, fetchStockDetail, clear])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) closePanel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closePanel])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (open && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, closePanel])

  // Get setups for this ticker (client-side filter from global setup store)
  const getSetupsForTicker = useSetupStore((s) => s.getSetupsForTicker)
  const tickerSetups = useMemo(() => (ticker ? getSetupsForTicker(ticker) : []), [ticker, getSetupsForTicker])

  const latestBar = dailyBars.length > 0 ? dailyBars[0] : null
  const latestStage = stock?.stages?.[0]
  const price = latestBar?.close
  const prevClose = dailyBars.length > 1 ? dailyBars[1]?.close : latestBar?.open
  const changePercent =
    price != null && prevClose != null ? ((price - prevClose) / prevClose) * 100 : null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{ transitionDuration: '200ms' }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-screen w-full flex-col border-l border-border-default bg-bg-surface shadow-2xl transition-transform sm:w-[480px] lg:w-[560px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{ transitionDuration: '300ms' }}
        role="dialog"
        aria-modal="true"
        aria-label={ticker ? `Stock detail: ${ticker}` : 'Stock detail panel'}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-border-default px-4 sm:h-14 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            {ticker ? (
              <>
                <span className="font-heading text-base font-bold text-text-primary sm:text-lg">
                  {ticker}
                </span>
                {stock?.name ? (
                  <span className="text-xs text-text-secondary sm:text-sm">{stock.name}</span>
                ) : null}
                {latestStage ? <StageTag stage={latestStage.stage} /> : null}
              </>
            ) : null}
          </div>
          <button
            onClick={closePanel}
            className="cursor-pointer rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-ring"
            aria-label="Close panel"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
            <div className="rounded-xl border border-bearish/30 bg-bearish/5 p-4 text-sm text-bearish">
              Failed to load: {error}
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Price header */}
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

              {/* Chart */}
              <StockChart
                dailyBars={dailyBars}
                spyBars={spyBars}
                setups={tickerSetups}
                height={300}
              />

              {/* Active Setups */}
              {tickerSetups.length > 0 ? (
                <Section title="Active Setups" icon={<TrendingUp className="h-3.5 w-3.5" />}>
                  <div className="space-y-2">
                    {tickerSetups.map((setup) => (
                      <SetupCard key={setup.id} setup={setup} />
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Evidence Timeline */}
              {evidence.length > 0 ? (
                <Section title="Confirmation / Violation" icon={<AlertCircle className="h-3.5 w-3.5" />}>
                  <div className="space-y-1.5">
                    {evidence.slice(0, 15).map((ev) => (
                      <EvidenceRow key={ev.id} evidence={ev} />
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Stage History */}
              {stageHistory.length > 0 ? (
                <Section title="Stage History" icon={<Clock className="h-3.5 w-3.5" />}>
                  <div className="space-y-1.5">
                    {stageHistory.slice(0, 10).map((sh) => (
                      <StageHistoryRow key={sh.id} entry={sh} />
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Key Levels */}
              {(tickerSetups.length > 0 || latestBar) ? (
                <Section title="Key Levels" icon={<BarChart2 className="h-3.5 w-3.5" />}>
                  <KeyLevels setups={tickerSetups} latestBar={latestBar} />
                </Section>
              ) : null}

              {/* Fundamentals */}
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

        {/* Action bar */}
        {ticker ? (
          <div className="flex items-center gap-2 border-t border-border-default bg-bg-surface px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
            <button className="flex-1 cursor-pointer rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover focus-ring sm:text-sm">
              Add to Watchlist
            </button>
            <button className="flex-1 cursor-pointer rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover focus-ring sm:text-sm">
              Configure Alerts
            </button>
            <button className="flex-1 cursor-pointer rounded-lg border border-bullish bg-bullish/10 px-3 py-2 text-xs font-medium text-bullish transition-colors hover:bg-bullish/20 focus-ring sm:text-sm">
              Trade Idea
            </button>
          </div>
        ) : null}
      </div>
    </>
  )
}

// ---- Sub-components ----

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
    <div className="flex items-center justify-between rounded-lg border border-border-muted bg-bg-elevated p-2.5 sm:p-3">
      <div className="flex items-center gap-2">
        <SetupTypeBadge type={setup.type} />
        <DirectionBadge direction={setup.direction} />
        <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:text-xs">
          {setup.state}
        </span>
      </div>
      <div className="flex items-center gap-3 text-right">
        {setup.pivotPrice != null ? (
          <div>
            <div className="text-[10px] text-text-muted">Pivot</div>
            <div className="font-mono text-xs text-text-primary">${formatPrice(setup.pivotPrice)}</div>
          </div>
        ) : null}
        {setup.riskReward != null ? (
          <div>
            <div className="text-[10px] text-text-muted">R:R</div>
            <div className="font-mono text-xs text-accent">{Number(setup.riskReward).toFixed(1)}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EvidenceRow({ evidence }: { evidence: ApiBarEvidence }) {
  const date = evidence.barDate.slice(0, 10)

  return (
    <div className="flex items-center justify-between rounded-lg bg-bg-elevated/50 px-3 py-1.5 sm:px-4 sm:py-2">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            evidence.isViolation ? 'bg-bearish' : evidence.bias === 'BULLISH' ? 'bg-bullish' : 'bg-bearish',
          )}
        />
        <span className="text-[10px] font-medium text-text-primary sm:text-xs">
          {evidence.pattern.replace(/_/g, ' ')}
        </span>
        {evidence.isViolation ? (
          <span className="rounded bg-bearish/15 px-1 py-0.5 text-[9px] font-medium text-bearish">
            VIOLATION
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-right">
        <span className="font-mono text-[10px] text-text-muted sm:text-xs">{date}</span>
        <span className="font-mono text-[10px] text-text-secondary sm:text-xs">
          ${formatPrice(evidence.keyLevelPrice)}
        </span>
      </div>
    </div>
  )
}

function StageHistoryRow({ entry }: { entry: ApiStageHistory }) {
  const date = entry.date.slice(0, 10)
  const num = parseStageToNumber(entry.stage)

  return (
    <div className="flex items-center justify-between rounded-lg bg-bg-elevated/50 px-3 py-1.5 sm:px-4 sm:py-2">
      <div className="flex items-center gap-2">
        <StageTag stage={num} />
        <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-muted">{entry.category}</span>
      </div>
      <span className="font-mono text-[10px] text-text-muted sm:text-xs">{date}</span>
    </div>
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
    if (setup.pivotPrice != null) levels.push({ label: `Pivot (${setup.type})`, price: setup.pivotPrice, color: 'text-accent' })
    if (setup.stopPrice != null) levels.push({ label: 'Stop', price: setup.stopPrice, color: 'text-bearish' })
    if (setup.targetPrice != null) levels.push({ label: 'Target', price: setup.targetPrice, color: 'text-bullish' })
  }

  if (latestBar) {
    if (latestBar.sma50 != null) levels.push({ label: 'SMA 50', price: latestBar.sma50, color: 'text-blue-400' })
    if (latestBar.sma200 != null) levels.push({ label: 'SMA 200', price: latestBar.sma200, color: 'text-red-400' })
  }

  if (levels.length === 0) return <span className="text-xs text-text-muted">No key levels</span>

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {levels.map((lvl, i) => (
        <div key={`${lvl.label}-${i}`} className="rounded-lg bg-bg-elevated p-2">
          <div className="text-[10px] text-text-muted">{lvl.label}</div>
          <div className={cn('font-mono text-xs font-semibold', lvl.color)}>
            ${formatPrice(lvl.price)}
          </div>
        </div>
      ))}
    </div>
  )
}

function FundamentalItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-elevated p-2">
      <div className="text-[10px] text-text-muted">{label}</div>
      <div className="text-xs font-medium text-text-primary sm:text-sm">{value}</div>
    </div>
  )
}
