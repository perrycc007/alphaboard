import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { SlidePanel } from './SlidePanel'
import { useSidebarStore } from '@/stores/useSidebarStore'
import { cn } from '@/lib/utils'

export function AppShell() {
  const collapsed = useSidebarStore((s) => s.collapsed)

  return (
    <div className="min-h-screen bg-bg-base">
      <Sidebar />
      <SlidePanel />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[margin-left]',
          collapsed ? 'ml-16' : 'ml-60',
        )}
        style={{ transitionDuration: '200ms' }}
      >
        <Header />

        <main className="flex-1 p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
