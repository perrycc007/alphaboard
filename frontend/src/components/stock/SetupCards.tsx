import type { ApiSetup } from '@/types'
import { SetupTypeBadge, DirectionBadge } from '@/components/shared'
import { formatPrice } from '@/lib/utils'

interface SetupCardsProps {
  setups: ApiSetup[]
}

export function SetupCards({ setups }: SetupCardsProps) {
  if (setups.length === 0) {
    return (
      <div className="rounded-lg border border-border-muted bg-bg-elevated p-4 text-center text-xs text-text-muted sm:p-6 sm:text-sm">
        No active setups
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      {setups.map((setup) => (
        <div
          key={setup.id}
          className="rounded-lg border border-border-default bg-bg-elevated p-3 sm:p-4"
        >
          <div className="mb-2 flex items-center gap-2 sm:gap-2.5">
            <SetupTypeBadge type={setup.type} size="sm" />
            <DirectionBadge direction={setup.direction} size="sm" />
            <span
              className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium sm:text-xs ${
                setup.state === 'READY'
                  ? 'bg-bullish/15 text-bullish'
                  : setup.state === 'TRIGGERED'
                    ? 'bg-accent/15 text-accent'
                    : 'bg-text-muted/15 text-text-muted'
              }`}
            >
              {setup.state}
            </span>
          </div>
          <div className="space-y-1 text-[10px] sm:text-xs">
            <MetricRow label="Pivot" value={setup.pivotPrice} tone="text-text-primary" />
            <MetricRow label="Stop" value={setup.stopPrice} tone="text-bearish" />
            <MetricRow label="Target" value={setup.targetPrice} tone="text-bullish" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MetricRow({
  label,
  value,
  tone,
}: {
  label: string
  value: number | null
  tone: string
}) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}:</span>
      <span className={`font-mono ${tone}`}>{value != null ? formatPrice(value) : 'N/A'}</span>
    </div>
  )
}
