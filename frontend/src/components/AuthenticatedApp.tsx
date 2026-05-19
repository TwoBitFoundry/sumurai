import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
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
import { ErrorBoundary } from './ErrorBoundary';

export type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings';

const TAB_ORDER = ['dashboard', 'transactions', 'budgets', 'accounts'] as const;

interface AuthenticatedAppProps {
  onLogout: () => void;
  initialTab?: TabKey;
  isOnline: boolean;
}

const pageVariants = {
  enter: (dir: number) => ({ x: `${dir * 60}px`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: `${dir * -60}px`, opacity: 0 }),
};

export function AuthenticatedApp({ onLogout, initialTab, isOnline }: AuthenticatedAppProps) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'dashboard');
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('current-month');
  const budgetMonth = useBudgetMonth();
  const transactionFilters = useTransactionFilterState();
  const swipeBlockedRef = useRef(false);

  const handleTabChange = (next: TabKey) => {
    const from = TAB_ORDER.indexOf(tab as (typeof TAB_ORDER)[number]);
    const to = TAB_ORDER.indexOf(next as (typeof TAB_ORDER)[number]);
    setDirection(to >= from || from === -1 ? 1 : -1);
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
        <div className={cn('w-full', 'max-w-full', 'lg:hidden')}>
          <TransactionsSearchBar
            search={transactionFilters.search}
            onSearch={transactionFilters.setSearch}
          />
        </div>
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
        <motion.div
          data-testid="page-swipe-container"
          style={{ touchAction: 'pan-y' }}
          onPanStart={(e) => {
            let el = e.target as HTMLElement | null;
            while (el) {
              if (el.dataset?.noSwipe !== undefined) {
                swipeBlockedRef.current = true;
                return;
              }
              el = el.parentElement;
            }
            swipeBlockedRef.current = false;
          }}
          onPanEnd={(_, info) => {
            if (swipeBlockedRef.current) return;
            if (tab === 'settings') return;
            const idx = TAB_ORDER.indexOf(tab as (typeof TAB_ORDER)[number]);
            if (idx === -1) return;
            if (info.offset.x < -50 && idx < TAB_ORDER.length - 1)
              handleTabChange(TAB_ORDER[idx + 1]);
            if (info.offset.x > 50 && idx > 0) handleTabChange(TAB_ORDER[idx - 1]);
          }}
        >
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

            <AnimatePresence mode="wait" custom={direction}>
              <motion.section
                key={tab}
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
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
