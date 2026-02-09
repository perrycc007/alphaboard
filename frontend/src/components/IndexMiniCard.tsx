import type { ApiMarketIndex } from '@/types'
import { cn } from '@/lib/utils'
import { formatPrice, formatPercent } from '@/lib/utils'

interface IndexMiniCardProps {
  index: ApiMarketIndex
}

export function IndexMiniCard({ index }: IndexMiniCardProps) {
  const latest = index.latest
  if (!latest) {
    return (
      <div className="rounded-lg border border-border-muted bg-bg-elevated p-2.5 sm:p-3">
        <div className="text-xs font-semibold text-text-primary sm:text-sm">{index.ticker}</div>
        <div className="text-[10px] text-text-muted">No data</div>
      </div>
    )
  }

  const changePercent = ((latest.close - latest.open) / latest.open) * 100

  return (
    <div className="rounded-lg border border-border-muted bg-bg-elevated p-2.5 sm:p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-text-primary sm:text-sm">{index.ticker}</div>
        <span className="text-[10px] text-text-muted sm:text-xs">{index.name}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-sm font-bold text-text-primary sm:text-base">
          ${formatPrice(latest.close)}
        </span>
        <span
          className={cn(
            'font-mono text-[10px] font-semibold sm:text-xs',
            changePercent >= 0 ? 'text-bullish' : 'text-bearish',
          )}
        >
          {formatPercent(changePercent)}
        </span>
      </div>
    </div>
  )
}
