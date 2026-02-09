import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ApiBreadthSnapshot } from '@/types'
import { cn } from '@/lib/utils'

interface BreadthSummaryBarProps {
  breadth: ApiBreadthSnapshot | null
}

function GaugeItem({ label, value, thresholds }: {
  label: string
  value: number | null
  thresholds?: { bullish: number; bearish: number }
}) {
  if (value == null) return null

  const defaults = thresholds ?? { bullish: 50, bearish: -50 }
  const isBullish = value > defaults.bullish
  const isBearish = value < defaults.bearish

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-text-muted sm:text-xs">{label}</span>
      <span
        className={cn(
          'font-mono text-xs font-bold sm:text-sm',
          isBullish ? 'text-bullish' : isBearish ? 'text-bearish' : 'text-text-secondary',
        )}
      >
        {typeof value === 'number' ? value.toFixed(1) : '-'}
      </span>
    </div>
  )
}

export function BreadthSummaryBar({ breadth }: BreadthSummaryBarProps) {
  const [expanded, setExpanded] = useState(false)

  if (!breadth) {
    return (
      <div className="rounded-lg border border-border-muted bg-bg-elevated p-3 text-xs text-text-muted">
        No breadth data available
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border-muted bg-bg-elevated">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3"
      >
        <div className="flex items-center gap-4 sm:gap-6">
          <GaugeItem label="NAAD" value={breadth.naad} thresholds={{ bullish: 0, bearish: 0 }} />
          <GaugeItem label="% > 50d" value={breadth.naa50r} thresholds={{ bullish: 60, bearish: 40 }} />
          <GaugeItem label="% > 200d" value={breadth.naa200r} thresholds={{ bullish: 60, bearish: 40 }} />
          <GaugeItem label="NH-NL" value={breadth.nahl} thresholds={{ bullish: 0, bearish: 0 }} />
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-text-muted sm:h-4 sm:w-4" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-text-muted sm:h-4 sm:w-4" />
        )}
      </button>

      {expanded ? (
        <div className="border-t border-border-muted px-3 py-3 sm:px-4 sm:py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <BreadthDetailItem
              label="Net Advance/Decline"
              value={breadth.naad}
              description="Net advancing vs declining stocks"
            />
            <BreadthDetailItem
              label="% Above 50 DMA"
              value={breadth.naa50r}
              suffix="%"
              description="Stocks above 50-day moving average"
            />
            <BreadthDetailItem
              label="% Above 200 DMA"
              value={breadth.naa200r}
              suffix="%"
              description="Stocks above 200-day moving average"
            />
            <BreadthDetailItem
              label="New High - New Low"
              value={breadth.nahl}
              description="New 52-week highs minus lows"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function BreadthDetailItem({
  label,
  value,
  suffix = '',
  description,
}: {
  label: string
  value: number | null
  suffix?: string
  description: string
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium text-text-secondary sm:text-xs">{label}</div>
      <div className="font-mono text-sm font-bold text-text-primary sm:text-base">
        {value != null ? `${value.toFixed(1)}${suffix}` : '-'}
      </div>
      <div className="text-[9px] text-text-muted sm:text-[10px]">{description}</div>
    </div>
  )
}
