import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import DashboardPage from '@/views/DashboardPage'
import TransactionsPage from '@/views/TransactionsPage'
import BudgetsPage from '@/views/BudgetsPage'
import AccountsPage from '@/views/AccountsPage'
import SettingsPage from '@/views/SettingsPage'
import Card from './ui/Card'
import { ErrorBoundary } from './ErrorBoundary'
import { GradientShell } from '../ui/primitives'
import { AppLayout } from '../layouts/AppLayout'
import { cn } from '@/ui/primitives'

export type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings'

interface AuthenticatedAppProps {
  onLogout: () => void
  initialTab?: TabKey
}

export function AuthenticatedApp({ onLogout, initialTab }: AuthenticatedAppProps) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'dashboard')
  const [error, setError] = useState<string | null>(null)

  return (
    <ErrorBoundary>
      <GradientShell className={cn('text-slate-900', 'dark:text-slate-100', 'transition-colors', 'duration-300')}>
        <AppLayout currentTab={tab} onTabChange={setTab} onLogout={onLogout}>
          {error && (
            <Card className={cn('mb-6', 'border-red-200', 'dark:border-red-700', 'bg-red-50', 'dark:bg-red-900/20')}>
              <div className={cn('text-sm', 'text-red-600', 'dark:text-red-400', 'font-medium')}>Error</div>
              <div className={cn('text-xs', 'text-red-500', 'dark:text-red-300', 'mt-1')}>{error}</div>
            </Card>
          )}

          <AnimatePresence mode="wait">
            <motion.section
              key={tab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {tab === 'dashboard' && <DashboardPage />}
              {tab === 'transactions' && <TransactionsPage />}
              {tab === 'budgets' && <BudgetsPage />}
              {tab === 'accounts' && <AccountsPage onError={setError} />}
              {tab === 'settings' && <SettingsPage onLogout={onLogout} />}
            </motion.section>
          </AnimatePresence>
        </AppLayout>
      </GradientShell>
    </ErrorBoundary>
  )
}

export default AuthenticatedApp
