import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'

import Dashboard from '@/pages/Dashboard'
import ThemeExplorer from '@/pages/ThemeExplorer'
import WatchlistPage from '@/pages/Watchlist'
import Journal from '@/pages/Journal'
import Playbook from '@/pages/Playbook'
import Screener from '@/pages/Screener'
import Simulate from '@/pages/Simulate'
import SettingsPage from '@/pages/Settings'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'themes', element: <ThemeExplorer /> },
      { path: 'watchlist', element: <WatchlistPage /> },
      { path: 'screener', element: <Screener /> },
      { path: 'journal', element: <Journal /> },
      { path: 'playbook', element: <Playbook /> },
      { path: 'simulate', element: <Simulate /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
