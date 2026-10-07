import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/ui/primitives';
import AccountsPage from '@/views/AccountsPage';
import DashboardPage from '@/views/DashboardPage';
import SettingsPage from '@/views/SettingsPage';
import TransactionsPage from '@/views/TransactionsPage';
import TrendsPage from '@/views/TrendsPage';
import { AppLayout } from '../layouts/AppLayout';
import { GradientShell } from '../ui/primitives';
import { getCurrentMonthSelection, type MonthYearSelection } from '../utils/dateRanges';
import { ErrorBoundary } from './ErrorBoundary';
import Card from './ui/Card';

export type TabKey = 'dashboard' | 'trends' | 'transactions' | 'accounts' | 'settings';

interface AuthenticatedAppProps {
  onLogout: () => void;
  initialTab?: TabKey;
}

export function AuthenticatedApp({ onLogout, initialTab }: AuthenticatedAppProps) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'dashboard');
  const [error, setError] = useState<string | null>(null);
  const [transactionAccountId, setTransactionAccountId] = useState<string | null>(null);
  const [transactionCategory, setTransactionCategory] = useState<string | null>(null);
  const [period, setPeriod] = useState<MonthYearSelection>(() => getCurrentMonthSelection());

  const openTransactionsForAccount = (accountId: string) => {
    setTransactionAccountId(accountId);
    setTransactionCategory(null);
    setTab('transactions');
  };

  const openTransactionsForCategory = (category: string, targetPeriod?: MonthYearSelection) => {
    if (targetPeriod) {
      setPeriod(targetPeriod);
    }
    setTransactionAccountId(null);
    setTransactionCategory(category);
    setTab('transactions');
  };

  const handleTabChange = (nextTab: TabKey) => {
    setTransactionAccountId(null);
    setTransactionCategory(null);
    setTab(nextTab);
  };

  return (
    <ErrorBoundary>
      <GradientShell
        className={cn('text-slate-900', 'dark:text-slate-100', 'transition-colors', 'duration-300')}
      >
        <AppLayout currentTab={tab} onTabChange={handleTabChange} onLogout={onLogout}>
          {error && (
            <Card
              className={cn(
                'mb-6',
                'border-red-200',
                'dark:border-red-700',
                'bg-red-50',
                'dark:bg-red-900/20'
              )}
            >
              <div className={cn('text-sm', 'text-red-600', 'dark:text-red-400', 'font-medium')}>
                Error
              </div>
              <div className={cn('text-xs', 'text-red-500', 'dark:text-red-300', 'mt-1')}>
                {error}
              </div>
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
              {tab === 'dashboard' && (
                <DashboardPage
                  period={period}
                  onPeriodChange={setPeriod}
                  onCategorySelect={openTransactionsForCategory}
                />
              )}
              {tab === 'trends' && <TrendsPage period={period} onPeriodChange={setPeriod} />}
              {tab === 'transactions' && (
                <TransactionsPage
                  initialAccountId={transactionAccountId}
                  initialCategory={transactionCategory}
                  period={period}
                  onPeriodChange={setPeriod}
                />
              )}
              {tab === 'accounts' && (
                <AccountsPage onError={setError} onAccountSelect={openTransactionsForAccount} />
              )}
              {tab === 'settings' && (
                <SettingsPage
                  onLogout={onLogout}
                  onNavigateToAccounts={() => handleTabChange('accounts')}
                />
              )}
            </motion.section>
          </AnimatePresence>
        </AppLayout>
      </GradientShell>
    </ErrorBoundary>
  );
}

export default AuthenticatedApp;
