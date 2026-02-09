import { cn } from '@/lib/utils'

type DirectionValue = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'LONG' | 'SHORT'

interface DirectionBadgeProps {
  direction: DirectionValue
  size?: 'sm' | 'md'
  className?: string
}

const DIRECTION_CONFIG: Record<DirectionValue, { label: string; className: string }> = {
  BULLISH: { label: 'Bullish', className: 'bg-bullish-muted text-bullish border-bullish/20' },
  BEARISH: { label: 'Bearish', className: 'bg-bearish-muted text-bearish border-bearish/20' },
  NEUTRAL: { label: 'Neutral', className: 'bg-bg-elevated text-text-secondary border-border-default' },
  LONG: { label: 'Long', className: 'bg-bullish-muted text-bullish border-bullish/20' },
  SHORT: { label: 'Short', className: 'bg-bearish-muted text-bearish border-bearish/20' },
}

export function DirectionBadge({ direction, size = 'sm', className }: DirectionBadgeProps) {
  const config = DIRECTION_CONFIG[direction]
  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded border font-medium leading-none',
        size === 'sm' && 'px-1.5 py-0.5 text-[10px] sm:text-xs',
        size === 'md' && 'px-2 py-1 text-xs sm:text-sm',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
