import type { Stock } from '@/types'
import { StageTag, CategoryTag, DirectionBadge } from '@/components/shared'
import { formatPrice, formatPercent } from '@/lib/utils'

interface StockHeaderProps {
  stock: Stock
}

export function StockHeader({ stock }: StockHeaderProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <h2 className="font-heading text-lg font-bold text-text-primary sm:text-xl lg:text-2xl">
              {stock.name}
            </h2>
            <StageTag stage={stock.stage} size="md" />
            <CategoryTag category={stock.category} size="md" />
          </div>
          <p className="mt-1 text-xs text-text-secondary sm:text-sm">
            {stock.sector} • {stock.industry}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-text-primary sm:text-xl lg:text-2xl">
            {formatPrice(stock.price)}
          </div>
          <div
            className={`mt-0.5 font-mono text-xs font-medium sm:text-sm ${
              stock.changePercent >= 0 ? 'text-bullish' : 'text-bearish'
            }`}
          >
            {formatPercent(stock.changePercent)}
          </div>
        </div>
      </div>

      {stock.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {stock.themes.map((theme) => (
            <span
              key={theme.id}
              className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent sm:text-xs"
            >
              {theme.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
