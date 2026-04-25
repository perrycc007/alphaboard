import { useState } from 'react'
import { Search, Bell, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function Header() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 bg-background/90 px-4 backdrop-blur-md sm:h-14 sm:gap-4 sm:px-6">
      {/* Search bar */}
      <div
        className={cn(
          'relative flex w-full max-w-sm items-center sm:max-w-md',
          searchFocused && 'scale-[1.01]',
        )}
      >
        <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-text-muted sm:h-4 sm:w-4" />
        <Input
          type="text"
          placeholder="Search ticker... (e.g. NVDA)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="h-8 border-border bg-card/80 pl-0 pr-14 text-xs shadow-none sm:h-9 sm:text-sm"
        />
        {searchQuery && (
          <Button
            onClick={() => setSearchQuery('')}
            variant="ghost"
            size="icon"
            className="absolute right-8 h-6 w-6 text-text-muted hover:text-text-secondary"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        )}
        <kbd className="absolute right-2 hidden rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
          /
        </kbd>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Breadth health dot */}
      <div className="flex items-center gap-2 text-xs text-text-secondary sm:text-sm">
        <div className="h-2 w-2 rounded-full bg-bullish sm:h-2.5 sm:w-2.5" title="Market health: Bullish" />
        <Badge className="hidden border-bullish/20 bg-bullish/10 text-bullish sm:inline-flex">
          Market OK
        </Badge>
      </div>

      {/* Notification bell */}
      <Button
        variant="ghost"
        size="icon"
        className="relative text-text-secondary hover:text-text-primary sm:size-10"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
        {/* Unread badge */}
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
      </Button>
    </header>
  )
}
