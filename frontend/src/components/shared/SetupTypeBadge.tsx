import type { SetupType } from '@/types'
import { cn } from '@/lib/utils'

const SETUP_CONFIG: Record<SetupType, { label: string; color: string }> = {
  VCP: { label: 'VCP', color: 'bg-setup-vcp/15 text-setup-vcp border-setup-vcp/25' },
  BREAKOUT_PIVOT: { label: 'BO Pivot', color: 'bg-setup-breakout/15 text-setup-breakout border-setup-breakout/25' },
  BREAKOUT_VCB: { label: 'BO VCB', color: 'bg-setup-breakout/15 text-setup-breakout border-setup-breakout/25' },
  BREAKOUT_WEDGE: { label: 'BO Wedge', color: 'bg-setup-breakout/15 text-setup-breakout border-setup-breakout/25' },
  PULLBACK_BUY: { label: 'Pullback', color: 'bg-setup-pullback/15 text-setup-pullback border-setup-pullback/25' },
  HIGH_TIGHT_FLAG: { label: 'HTF', color: 'bg-setup-htf/15 text-setup-htf border-setup-htf/25' },
  UNDERCUT_RALLY: { label: 'U&R', color: 'bg-setup-undercut/15 text-setup-undercut border-setup-undercut/25' },
  DOUBLE_TOP: { label: 'Dbl Top', color: 'bg-setup-double-top/15 text-setup-double-top border-setup-double-top/25' },
  FAIL_BREAKOUT: { label: 'Fail BO', color: 'bg-setup-fail/15 text-setup-fail border-setup-fail/25' },
  FAIL_BASE: { label: 'Fail Base', color: 'bg-setup-fail/15 text-setup-fail border-setup-fail/25' },
  INTRADAY_BASE: { label: 'ID Base', color: 'bg-setup-intraday-base/15 text-setup-intraday-base border-setup-intraday-base/25' },
  CROSS_620: { label: '6/20 Cross', color: 'bg-setup-cross620/15 text-setup-cross620 border-setup-cross620/25' },
  GAP_UP: { label: 'Gap Up', color: 'bg-setup-gap/15 text-setup-gap border-setup-gap/25' },
  GAP_DOWN: { label: 'Gap Down', color: 'bg-bearish/15 text-bearish border-bearish/25' },
  TIRING_DOWN: { label: 'Tiring', color: 'bg-setup-tiring-down/15 text-setup-tiring-down border-setup-tiring-down/25' },
}

interface SetupTypeBadgeProps {
  type: SetupType
  size?: 'sm' | 'md'
  className?: string
}

export function SetupTypeBadge({ type, size = 'sm', className }: SetupTypeBadgeProps) {
  const config = SETUP_CONFIG[type]
  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded border font-medium leading-none',
        size === 'sm' && 'px-1.5 py-0.5 text-[10px] sm:text-xs',
        size === 'md' && 'px-2 py-1 text-xs sm:text-sm',
        config.color,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
