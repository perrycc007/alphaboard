import { cn } from '@/lib/utils'
import { formatPrice, formatPercent } from '@/lib/utils'

interface PnLDisplayProps {
  value: number
  percent?: number
  size?: 'sm' | 'md' | 'lg'
  showSign?: boolean
  className?: string
}

export function PnLDisplay({ value, percent, size = 'md', showSign = true, className }: PnLDisplayProps) {
  const isPositive = value >= 0

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono font-semibold',
        isPositive ? 'text-bullish' : 'text-bearish',
        size === 'sm' && 'text-[10px] sm:text-xs',
        size === 'md' && 'text-xs sm:text-sm',
        size === 'lg' && 'text-sm sm:text-base lg:text-lg',
        className,
      )}
    >
      <span>
        {showSign && isPositive ? '+' : ''}${formatPrice(Math.abs(value))}
      </span>
      {percent !== undefined && (
        <span className="opacity-70">({formatPercent(percent)})</span>
      )}
    </span>
  )
}
