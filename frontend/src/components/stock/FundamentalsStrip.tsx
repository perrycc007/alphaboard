import type { Stock } from '@/types'
import { formatCompactNumber } from '@/lib/utils'

interface FundamentalsStripProps {
  stock: Stock
}

export function FundamentalsStrip({ stock }: FundamentalsStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-border-default bg-bg-elevated p-3 sm:grid-cols-4 sm:gap-4 sm:p-4">
      <div>
        <div className="text-[10px] text-text-secondary sm:text-xs">Market Cap</div>
        <div className="mt-1 font-mono text-xs font-semibold text-text-primary sm:text-sm">
          {formatCompactNumber(stock.marketCap)}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-text-secondary sm:text-xs">Avg Volume</div>
        <div className="mt-1 font-mono text-xs font-semibold text-text-primary sm:text-sm">
          {formatCompactNumber(stock.avgVolume)}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-text-secondary sm:text-xs">Sector</div>
        <div className="mt-1 text-xs font-medium text-text-primary sm:text-sm">
          {stock.sector || 'N/A'}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-text-secondary sm:text-xs">Exchange</div>
        <div className="mt-1 text-xs font-medium text-text-primary sm:text-sm">
          {stock.exchange || 'N/A'}
        </div>
      </div>
    </div>
  )
}
