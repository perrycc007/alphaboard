import { cn } from '@/lib/utils'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center sm:py-16',
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated sm:mb-4 sm:h-14 sm:w-14">
        <Icon className="h-5 w-5 text-text-muted sm:h-6 sm:w-6" />
      </div>
      <h3 className="mb-1 font-heading text-sm font-semibold text-text-primary sm:text-base">
        {title}
      </h3>
      {description && (
        <p className="mb-4 max-w-sm text-xs text-text-secondary sm:text-sm">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
