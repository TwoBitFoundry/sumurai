import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import DashboardPage from '../pages/DashboardPage'
import TransactionsPage from '../pages/TransactionsPage'
import BudgetsPage from '../pages/BudgetsPage'
import AccountsPage from '../pages/AccountsPage'
import Card from './ui/Card'
import { ErrorBoundary } from './ErrorBoundary'
import { GradientShell } from '../ui/primitives'
import { AppLayout } from '../layouts/AppLayout'

type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts'

interface AuthenticatedAppProps {
  onLogout: () => void
}

export function AuthenticatedApp({ onLogout }: AuthenticatedAppProps) {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [error, setError] = useState<string | null>(null)

  return (
    <ErrorBoundary>
      <GradientShell variant="app" className="text-slate-900 dark:text-slate-100 transition-colors duration-300">
        <AppLayout currentTab={tab} onTabChange={setTab} onLogout={onLogout}>
          {error && (
            <Card className="mb-6 border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
              <div className="text-sm text-red-600 dark:text-red-400 font-medium">Error</div>
              <div className="text-xs text-red-500 dark:text-red-300 mt-1">{error}</div>
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
            </motion.section>
          </AnimatePresence>
        </AppLayout>
      </GradientShell>
    </ErrorBoundary>
  )
}

export default AuthenticatedApp
