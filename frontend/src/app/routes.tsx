import { Suspense, lazy } from 'react'
import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const ThemeExplorer = lazy(() => import('@/pages/ThemeExplorer'))
const WatchlistPage = lazy(() => import('@/pages/Watchlist'))
const Journal = lazy(() => import('@/pages/Journal'))
const Playbook = lazy(() => import('@/pages/Playbook'))
const Screener = lazy(() => import('@/pages/Screener'))
const Simulate = lazy(() => import('@/pages/Simulate'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const LabelPage = lazy(() => import('@/pages/Label'))
const MarketRegimes = lazy(() => import('@/pages/MarketRegimes'))
const ResearchReport = lazy(() => import('@/pages/ResearchReport'))
const FocusListPage = lazy(() => import('@/pages/FocusList'))
const MarketCondition = lazy(() => import('@/pages/MarketCondition'))
const Catalysts = lazy(() => import('@/pages/Catalysts'))

function routeElement(Component: ComponentType) {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-text-secondary">Loading page...</div>}>
      <Component />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: routeElement(Dashboard) },
      { path: 'themes', element: routeElement(ThemeExplorer) },
      { path: 'watchlist', element: routeElement(WatchlistPage) },
      { path: 'screener', element: routeElement(Screener) },
      { path: 'journal', element: routeElement(Journal) },
      { path: 'playbook', element: routeElement(Playbook) },
      { path: 'simulate', element: routeElement(Simulate) },
      { path: 'regimes', element: routeElement(MarketRegimes) },
      { path: 'research', element: routeElement(ResearchReport) },
      { path: 'focus-list', element: routeElement(FocusListPage) },
      { path: 'market-condition', element: routeElement(MarketCondition) },
      { path: 'catalysts', element: routeElement(Catalysts) },
      { path: 'label', element: routeElement(LabelPage) },
      { path: 'settings', element: routeElement(SettingsPage) },
    ],
  },
])
