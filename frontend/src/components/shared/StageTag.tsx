import type { StageNumber, StageEnum } from '@/types'
import { parseStageToNumber } from '@/types'
import { cn } from '@/lib/utils'

const STAGE_CONFIG: Record<StageNumber, { label: string; className: string }> = {
  1: { label: 'S1', className: 'bg-stage-1/15 text-stage-1 border-stage-1/25' },
  2: { label: 'S2', className: 'bg-stage-2/15 text-stage-2 border-stage-2/25' },
  3: { label: 'S3', className: 'bg-stage-3/15 text-stage-3 border-stage-3/25' },
  4: { label: 'S4', className: 'bg-stage-4/15 text-stage-4 border-stage-4/25' },
}

interface StageTagProps {
  /** Accepts both numeric (1-4) and enum ('STAGE_1'-'STAGE_4') formats */
  stage: StageNumber | StageEnum
  size?: 'sm' | 'md'
  className?: string
}

export function StageTag({ stage, size = 'sm', className }: StageTagProps) {
  const num: StageNumber = typeof stage === 'number' ? stage : parseStageToNumber(stage)
  const config = STAGE_CONFIG[num]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded border font-mono font-semibold leading-none',
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
