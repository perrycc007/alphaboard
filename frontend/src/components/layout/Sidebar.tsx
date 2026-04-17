import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Layers,
  Eye,
  BookOpen,
  Trophy,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Filter,
  BarChart3,
  Tag,
  Globe2,
} from 'lucide-react'
import { useSidebarStore } from '@/stores/useSidebarStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/themes', label: 'Themes', icon: Layers },
  { to: '/watchlist', label: 'Watchlist', icon: Eye },
  { to: '/screener', label: 'Screener', icon: Filter },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/playbook', label: 'Playbook', icon: Trophy },
  { to: '/simulate', label: 'Simulator', icon: BarChart3 },
  { to: '/regimes', label: 'Regimes', icon: Globe2 },
  { to: '/label', label: 'Labeling', icon: Tag },
] as const

const BOTTOM_ITEMS = [
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggle = useSidebarStore((s) => s.toggle)

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all',
        collapsed ? 'w-16' : 'w-60',
      )}
      style={{ transitionDuration: '200ms' }}
    >
      {/* Logo area */}
      <div
        className={cn(
          'flex h-14 items-center px-4',
          collapsed ? 'justify-center' : 'gap-3',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent font-heading text-sm font-bold text-white sm:h-8 sm:w-8">
          A
        </div>
        {!collapsed && (
          <span className="font-heading text-base font-semibold tracking-tight text-text-primary sm:text-lg">
            Alphaboard
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-1 px-2 py-3 sm:px-3 sm:py-4">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom nav */}
      <Separator />
      <div className="space-y-1 px-2 py-3 sm:px-3 sm:py-4">
        {BOTTOM_ITEMS.map((item) => (
          <SidebarLink key={item.to} {...item} collapsed={collapsed} />
        ))}

        {/* Collapse toggle */}
        <Button
          onClick={toggle}
          variant="ghost"
          className={cn(
            'h-auto w-full justify-start gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-accent/10 hover:text-text-primary',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
          )}
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  )
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  collapsed,
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors focus-ring cursor-pointer sm:text-sm',
          isActive
            ? 'bg-accent/10 text-accent shadow-inner'
            : 'text-text-secondary hover:bg-secondary hover:text-text-primary',
          collapsed && 'justify-center px-0',
        )
      }
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )
}
