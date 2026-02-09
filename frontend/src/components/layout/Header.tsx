import { useState } from 'react'
import { Search, Bell, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Header() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border-default bg-bg-surface/80 px-4 backdrop-blur-md sm:h-14 sm:gap-4 sm:px-6">
      {/* Search bar */}
      <div
        className={cn(
          'relative flex h-8 w-full max-w-sm items-center rounded-lg border bg-bg-base px-3 transition-colors sm:h-9 sm:max-w-md',
          searchFocused ? 'border-accent' : 'border-border-default',
        )}
      >
        <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-text-muted sm:h-4 sm:w-4" />
        <input
          type="text"
          placeholder="Search ticker... (e.g. NVDA)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none sm:text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="ml-1 text-text-muted hover:text-text-secondary cursor-pointer"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        )}
        <kbd className="ml-2 hidden rounded border border-border-default bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted sm:inline-block">
          /
        </kbd>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Breadth health dot */}
      <div className="flex items-center gap-2 text-xs text-text-secondary sm:text-sm">
        <div className="h-2 w-2 rounded-full bg-bullish sm:h-2.5 sm:w-2.5" title="Market health: Bullish" />
        <span className="hidden sm:inline">Market OK</span>
      </div>

      {/* Notification bell */}
      <button
        className="relative rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-ring cursor-pointer sm:p-2"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
        {/* Unread badge */}
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
      </button>
    </header>
  )
}
