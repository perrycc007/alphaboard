import React from 'react'
import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  className?: string
  variant?: 'text' | 'card' | 'chart' | 'circle'
}

export function LoadingSkeleton({ className, variant = 'text' }: LoadingSkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-bg-elevated',
        variant === 'text' && 'h-4 w-full',
        variant === 'card' && 'h-32 w-full rounded-xl',
        variant === 'chart' && 'h-48 w-full rounded-xl',
        variant === 'circle' && 'h-10 w-10 rounded-full',
        className,
      )}
    />
  )
}

interface SkeletonGroupProps {
  count?: number
  className?: string
  children?: React.ReactNode
}

/**
 * Renders `count` skeleton items. If children are provided, clones the child
 * element for each item. Otherwise renders default LoadingSkeleton rows.
 */
export function SkeletonGroup({ count = 3, className, children }: SkeletonGroupProps) {
  return (
    <div className={cn('space-y-2 sm:space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) =>
        children ? (
          <React.Fragment key={i}>
            {React.Children.map(children, (child) =>
              React.isValidElement(child) ? React.cloneElement(child) : child,
            )}
          </React.Fragment>
        ) : (
          <LoadingSkeleton key={i} variant="text" className={i === count - 1 ? 'w-2/3' : ''} />
        ),
      )}
    </div>
  )
}
