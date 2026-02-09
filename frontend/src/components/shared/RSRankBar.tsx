import { cn } from '@/lib/utils'

interface RSRankBarProps {
  rank: number
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
}

export function RSRankBar({ rank, size = 'sm', showLabel = true, className }: RSRankBarProps) {
  const clampedRank = Math.max(0, Math.min(100, rank))

  const getColor = () => {
    if (clampedRank >= 80) return 'bg-bullish'
    if (clampedRank >= 60) return 'bg-stage-3'
    if (clampedRank >= 40) return 'bg-text-secondary'
    return 'bg-bearish'
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-full bg-bg-elevated',
          size === 'sm' && 'h-1.5 w-12 sm:w-16',
          size === 'md' && 'h-2 w-16 sm:w-20',
        )}
      >
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all', getColor())}
          style={{ width: `${clampedRank}%`, transitionDuration: '300ms' }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            'font-mono font-medium text-text-secondary',
            size === 'sm' && 'text-[10px] sm:text-xs',
            size === 'md' && 'text-xs sm:text-sm',
          )}
        >
          {clampedRank}
        </span>
      )}
    </div>
  )
}
