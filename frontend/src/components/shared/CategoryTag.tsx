import type { StockCategory } from '@/types'
import { cn } from '@/lib/utils'

const CATEGORY_CONFIG: Record<StockCategory, { label: string; className: string } | null> = {
  HOT: { label: 'HOT', className: 'bg-cat-hot/15 text-cat-hot border-cat-hot/25' },
  FORMER_HOT: { label: 'Former', className: 'bg-cat-former-hot/15 text-cat-former-hot border-cat-former-hot/25' },
  COMMODITY: { label: 'Commodity', className: 'bg-cat-commodity/15 text-cat-commodity border-cat-commodity/25' },
  NONE: null,
}

interface CategoryTagProps {
  category: StockCategory
  size?: 'sm' | 'md'
  className?: string
}

export function CategoryTag({ category, size = 'sm', className }: CategoryTagProps) {
  const config = CATEGORY_CONFIG[category]
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
