import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { BottomContextualBar } from '@/components/BottomContextualBar';
import { DateRangePillSlider } from '@/features/analytics/components/DateRangePillSlider';
import { BudgetMonthPillSlider } from '@/features/budgets/components/BudgetMonthPillSlider';
import { useBudgetMonth } from '@/features/budgets/hooks/useBudgetMonth';
import { TransactionsSearchBar } from '@/features/transactions/components/TransactionsSearchBar';
import { useTransactionFilterState } from '@/features/transactions/hooks/useTransactionFilterState';
import { Alert, cn } from '@/ui/primitives';
import AccountsPage from '@/views/AccountsPage';
import BudgetsPage from '@/views/BudgetsPage';
import DashboardPage from '@/views/DashboardPage';
import SettingsPage from '@/views/SettingsPage';
import TransactionsPage from '@/views/TransactionsPage';
import { AppLayout } from '../layouts/AppLayout';
import { GradientShell } from '../ui/primitives';
import { text as uiTextRecipes } from '../ui/recipes';
import type { DateRangeKey as DateRange } from '../utils/dateRanges';
import {
  getSessionDashboardDateRange,
  setSessionDashboardDateRange,
} from '../utils/sessionPreferences';
import { ErrorBoundary } from './ErrorBoundary';

export type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings';

const TAB_INDEX = new Map<TabKey, number>([
  ['dashboard', 0],
  ['transactions', 1],
  ['budgets', 2],
  ['accounts', 3],
  ['settings', 4],
]);

interface AuthenticatedAppProps {
  onLogout: () => void;
  initialTab?: TabKey;
  isOnline: boolean;
}

export function AuthenticatedApp({ onLogout, initialTab, isOnline }: AuthenticatedAppProps) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'dashboard');
  const [tabTransitionDirection, setTabTransitionDirection] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRangeState] = useState<DateRange>(
    () => getSessionDashboardDateRange() ?? 'current-month'
  );
  const setDateRange = (next: DateRange) => {
    setDateRangeState(next);
    setSessionDashboardDateRange(next);
  };
  const budgetMonth = useBudgetMonth();
  const transactionFilters = useTransactionFilterState();

  const handleTabChange = (next: TabKey) => {
    const currentIndex = TAB_INDEX.get(tab) ?? 0;
    const nextIndex = TAB_INDEX.get(next) ?? currentIndex;
    setTabTransitionDirection(nextIndex === currentIndex ? 0 : nextIndex > currentIndex ? 1 : -1);
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const bottomBarContent =
    tab === 'dashboard' ? (
      <BottomContextualBar>
        <DateRangePillSlider dateRange={dateRange} onChange={setDateRange} />
      </BottomContextualBar>
    ) : tab === 'transactions' ? (
      <BottomContextualBar>
        <TransactionsSearchBar
          search={transactionFilters.search}
          onSearch={transactionFilters.setSearch}
        />
      </BottomContextualBar>
    ) : tab === 'budgets' ? (
      <BottomContextualBar>
        <BudgetMonthPillSlider
          monthLabel={budgetMonth.monthLabel}
          onPreviousMonth={budgetMonth.goToPreviousMonth}
          onNextMonth={budgetMonth.goToNextMonth}
          onCurrentMonth={budgetMonth.goToCurrentMonth}
        />
      </BottomContextualBar>
    ) : null;
  return (
    <ErrorBoundary>
      <GradientShell className={cn(uiTextRecipes.primary, 'transition-colors', 'duration-300')}>
        <motion.div>
          <AppLayout
            currentTab={tab}
            onTabChange={handleTabChange}
            onLogout={onLogout}
            isOnline={isOnline}
            bottomBarContent={bottomBarContent}
          >
            {error && (
              <Alert variant="error" title="Error" className={cn('mb-6')}>
                {error}
              </Alert>
            )}

            <AnimatePresence initial={false} mode="wait" custom={tabTransitionDirection}>
              <motion.section
                key={tab}
                data-testid="tab-transition-panel"
                custom={tabTransitionDirection}
                initial={{
                  opacity: 0,
                  x: tabTransitionDirection === 0 ? 0 : tabTransitionDirection > 0 ? 24 : -24,
                }}
                animate={{ opacity: 1, x: 0 }}
                exit={{
                  opacity: 0,
                  x: tabTransitionDirection === 0 ? 0 : tabTransitionDirection > 0 ? -24 : 24,
                }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              >
                {tab === 'dashboard' && (
                  <DashboardPage dateRange={dateRange} setDateRange={setDateRange} />
                )}
                {tab === 'transactions' && <TransactionsPage filterControl={transactionFilters} />}
                {tab === 'budgets' && <BudgetsPage monthControl={budgetMonth} />}
                {tab === 'accounts' && <AccountsPage onError={setError} />}
                {tab === 'settings' && <SettingsPage onLogout={onLogout} />}
              </motion.section>
            </AnimatePresence>
          </AppLayout>
        </motion.div>
      </GradientShell>
    </ErrorBoundary>
  );
}

export default AuthenticatedApp;
