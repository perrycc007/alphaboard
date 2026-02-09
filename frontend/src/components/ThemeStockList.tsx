import type { ApiThemeDetail, ApiThemeStock } from '@/types'
import { parseStageToNumber } from '@/types'
import { useSlidePanelStore } from '@/stores/useSlidePanelStore'
import { useSetupStore } from '@/stores/useSetupStore'
import { StageTag, SetupTypeBadge } from '@/components/shared'
import { formatPrice, formatCompactNumber } from '@/lib/utils'

interface ThemeStockListProps {
  detail: ApiThemeDetail
}

export function ThemeStockList({ detail }: ThemeStockListProps) {
  const openPanel = useSlidePanelStore((s) => s.openPanel)

  return (
    <div className="space-y-3 sm:space-y-4">
      {detail.groups.map((group) => (
        <div key={group.id} className="space-y-1.5 sm:space-y-2">
          <h4 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted sm:text-xs">
            {group.name}
          </h4>
          <div className="space-y-1">
            {group.themeStocks.map((ts) => (
              <StockRow key={ts.id} themeStock={ts} onSelect={openPanel} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function StockRow({
  themeStock,
  onSelect,
}: {
  themeStock: ApiThemeStock
  onSelect: (ticker: string) => void
}) {
  const { stock } = themeStock
  const latestBar = stock.dailyBars?.[0]
  const latestStage = stock.stages?.[0]
  const tickerSetups = useSetupStore((s) => s.getSetupsForTicker(stock.ticker))

  const price = latestBar?.close
  const changePercent = latestBar
    ? ((latestBar.close - latestBar.open) / latestBar.open) * 100
    : null
  const rsRank = latestBar?.rsRank

  return (
    <button
      onClick={() => onSelect(stock.ticker)}
      className="flex w-full items-center justify-between rounded-lg border border-transparent bg-bg-elevated/50 px-3 py-2 text-left transition-colors hover:border-border-accent/20 hover:bg-bg-elevated cursor-pointer sm:px-4 sm:py-2.5"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="w-12 font-heading text-xs font-bold text-text-primary sm:w-14 sm:text-sm">
          {stock.ticker}
        </span>

        {latestStage ? (
          <StageTag stage={latestStage.stage} />
        ) : null}

        {tickerSetups.length > 0 ? (
          <div className="flex gap-1">
            {tickerSetups.slice(0, 2).map((setup) => (
              <SetupTypeBadge key={setup.id} type={setup.type} />
            ))}
            {tickerSetups.length > 2 ? (
              <span className="inline-flex items-center rounded border border-border-muted px-1 text-[10px] text-text-muted">
                +{tickerSetups.length - 2}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {rsRank != null ? (
          <div className="hidden items-center gap-1 sm:flex">
            <span className="text-[10px] text-text-muted">RS</span>
            <span className="font-mono text-[10px] text-text-secondary sm:text-xs">
              {rsRank}
            </span>
          </div>
        ) : null}

        {price != null ? (
          <span className="font-mono text-xs text-text-secondary sm:text-sm">
            ${formatPrice(price)}
          </span>
        ) : null}

        {changePercent != null ? (
          <span
            className={`font-mono text-[10px] sm:text-xs ${
              changePercent >= 0 ? 'text-bullish' : 'text-bearish'
            }`}
          >
            {changePercent >= 0 ? '+' : ''}
            {changePercent.toFixed(1)}%
          </span>
        ) : null}

        {stock.marketCap != null ? (
          <span className="hidden font-mono text-[10px] text-text-muted lg:inline sm:text-xs">
            {formatCompactNumber(stock.marketCap)}
          </span>
        ) : null}
      </div>
    </button>
  )
}
