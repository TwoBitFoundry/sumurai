import { TrendingUp } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';

import { cn, EmptyState, Pill } from '@/ui/primitives';
import {
  dashboardCategoryCard,
  border as semanticBorders,
  surface as semanticSurfaces,
  radius as uiRadiusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import BalancesOverview from '../components/BalancesOverview';
import { useTheme } from '../context/ThemeContext';
import { DashboardCalculator } from '../domain/DashboardCalculator';
import { categoriesToDonut } from '../features/analytics/adapters/chartData';
import { BudgetVsActualChart } from '../features/analytics/components/BudgetVsActualChart';
import { CashFlowChart } from '../features/analytics/components/CashFlowChart';
import {
  ChartGlassTooltip,
  chartTooltipRechartsProps,
} from '../features/analytics/components/ChartGlassTooltip';
import DashboardChartCard from '../features/analytics/components/DashboardChartCard';
import { SpendingByCategoryChart } from '../features/analytics/components/SpendingByCategoryChart';
import { TopMerchantsList } from '../features/analytics/components/TopMerchantsList';
import { useAnalytics } from '../features/analytics/hooks/useAnalytics';
import { useCashFlow } from '../features/analytics/hooks/useCashFlow';
import { useChartContainerSize } from '../features/analytics/hooks/useChartContainerSize';
import { useDebouncedChartRecalc } from '../features/analytics/hooks/useDebouncedChartRecalc';
import { useBudgets } from '../features/budgets/hooks/useBudgets';
import { useCategories } from '../features/transactions/hooks/useCategories';
import { PageLayout } from '../layouts/PageLayout';
import type { DateRangeKey as DateRange } from '../utils/dateRanges';
import { fmtUSD } from '../utils/format';

const dashboardLoadingCard = [
  `min-h-[28px] ${uiRadiusRecipes.standard} border animate-pulse`,
  ...semanticBorders.subtle,
  ...semanticSurfaces.mutedChip,
] as const;

const DashboardPage: React.FC<{
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}> = ({ dateRange }) => {
  const { colors } = useTheme();
  const { accentIndexByName } = useCategories();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const analytics = useAnalytics(dateRange);
  const analyticsLoading = analytics.loading;
  const analyticsRefreshing = analytics.refreshing;
  const byCat = useMemo(
    () => categoriesToDonut(analytics.categories, accentIndexByName),
    [accentIndexByName, analytics.categories]
  );
  const cashFlow = useCashFlow(6, dateRange);
  const cashFlowSeries = cashFlow.series;
  const debouncedCashFlowSeries = useDebouncedChartRecalc(cashFlowSeries);
  const cashFlowLoading = cashFlow.loading;
  const cashFlowRefreshing = cashFlow.refreshing;
  const cashFlowError = cashFlow.error;

  const budgets = useBudgets();
  const totalBudget = useMemo(
    () => budgets.budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0),
    [budgets.budgets]
  );
  const budgetVsActualData = useMemo(
    () =>
      cashFlowSeries.map((point) => ({
        month: point.month,
        expenses: point.expenses,
      })),
    [cashFlowSeries]
  );
  const debouncedBudgetVsActualData = useDebouncedChartRecalc(budgetVsActualData);

  const monthSpend = analytics.spendingTotal;
  const handleCategoryHover = useCallback((name: string | null) => {
    setHoveredCategory(name);
  }, []);

  const {
    ref: netChartRef,
    width: netChartWidth,
    height: netChartHeight,
  } = useChartContainerSize();

  const {
    ref: budgetChartRef,
    width: budgetChartWidth,
    height: budgetChartHeight,
  } = useChartContainerSize();

  return (
    <div data-testid="dashboard-page">
      <PageLayout
        badge="Dashboard"
        title="Appraise the warchest"
        subtitle="Deepen understanding of holdings across ally accounts."
        stats={<BalancesOverview />}
      >
        <div
          className={cn(
            'grid',
            'w-full',
            'min-w-0',
            'max-w-full',
            'grid-cols-1',
            'lg:grid-cols-2',
            'auto-rows-[minmax(390px,auto)]',
            'gap-4',
            'md:gap-6',
            'items-stretch'
          )}
        >
          <DashboardChartCard
            className={cn('min-w-0', 'col-span-1')}
            title="Spending over time"
            refreshingLabel="Reading the field..."
            isRefreshing={!analyticsLoading && analyticsRefreshing}
          >
            {analyticsLoading && (
              <div className={cn('mb-2', uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                Fetching analytics
              </div>
            )}
            {byCat.length === 0 ? (
              <div className={cn('flex-1', 'min-h-0', 'flex', 'items-center', 'justify-center')}>
                <SpendingByCategoryChart
                  data={byCat}
                  total={monthSpend}
                  hoveredCategory={hoveredCategory}
                  setHoveredCategory={setHoveredCategory}
                />
              </div>
            ) : (
              <div
                className={cn(
                  'grid',
                  'grid-cols-[repeat(auto-fit,minmax(180px,1fr))]',
                  'flex-1',
                  'min-h-0',
                  'gap-4',
                  'overflow-hidden'
                )}
              >
                <div className={cn('min-w-0', 'min-h-0', 'flex', 'items-center', 'justify-center')}>
                  <SpendingByCategoryChart
                    data={byCat}
                    total={monthSpend}
                    hoveredCategory={hoveredCategory}
                    setHoveredCategory={setHoveredCategory}
                  />
                </div>
                <div
                  className={cn(
                    'flex-1',
                    'min-w-0',
                    'self-center',
                    'flex',
                    'flex-col',
                    'gap-[length:var(--spacing-compact-gap)]'
                  )}
                >
                  {(() => {
                    const categorySum = byCat.reduce(
                      (sum, c) => sum + (Number.isFinite(c.value) ? c.value : 0),
                      0
                    );
                    const top = byCat.slice(0, 5);
                    return top.map((cat) => {
                      const percentage =
                        categorySum > 0 ? ((cat.value / categorySum) * 100).toFixed(1) : '0.0';
                      const isHovered = hoveredCategory === cat.name;
                      return (
                        <button
                          key={`topcard-${cat.name}`}
                          type="button"
                          className={cn('p-2', dashboardCategoryCard.shell)}
                          style={isHovered ? { borderColor: colors.chart.primary[0] } : undefined}
                          onMouseEnter={() => handleCategoryHover(cat.name)}
                          onMouseLeave={() => handleCategoryHover(null)}
                          onClick={() => handleCategoryHover(cat.name)}
                        >
                          <div className={cn('flex', 'items-center', 'justify-between', 'gap-2')}>
                            <Pill
                              categoryName={cat.categoryKey}
                              accentIndexByName={accentIndexByName}
                              className={cn('min-w-0', 'truncate')}
                            >
                              {cat.name}
                            </Pill>
                            <div className={cn('flex', 'items-baseline', 'gap-2', 'shrink-0')}>
                              <span
                                className={cn(
                                  uiTypographyRecipes.bodyStrong,
                                  uiTextRecipes.primary
                                )}
                              >
                                {fmtUSD(cat.value)}
                              </span>
                              <span
                                className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}
                              >
                                {percentage}%
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </DashboardChartCard>

          <DashboardChartCard
            className={cn('min-w-0')}
            title="Top merchants over time"
            refreshingLabel="Reading the field..."
            isRefreshing={!analyticsLoading && analyticsRefreshing}
            bodyClassName={cn('overflow-hidden')}
          >
            <div className={cn('h-full', 'overflow-hidden')}>
              <TopMerchantsList
                merchants={analytics.topMerchants}
                className={cn('h-full', 'overflow-y-auto')}
              />
            </div>
          </DashboardChartCard>

          <DashboardChartCard
            className={cn('min-w-0')}
            title="Wealth flow"
            refreshingLabel="Tracing the flow..."
            isRefreshing={!cashFlowLoading && cashFlowRefreshing}
          >
            {cashFlowLoading ? (
              <div className={cn('flex-1', 'min-h-0', dashboardLoadingCard)} />
            ) : cashFlowError ? (
              <div
                className={cn(
                  'flex-1',
                  'min-h-0',
                  'min-h-[28px]',
                  uiTypographyRecipes.body,
                  uiTextRecipes.danger
                )}
              >
                {cashFlowError}
              </div>
            ) : cashFlowSeries.length === 0 ? (
              <div
                className={cn(
                  'flex-1',
                  'min-h-0',
                  'min-h-[28px]',
                  'flex',
                  'items-center',
                  'justify-center'
                )}
              >
                <EmptyState
                  icon={TrendingUp}
                  title="The ledger lies still."
                  description="No transactions for this period"
                />
              </div>
            ) : (
              <div ref={netChartRef} className={cn('flex-1', 'min-h-0', 'w-full', 'min-w-0')}>
                {netChartWidth > 0 && netChartHeight > 0 ? (
                  <CashFlowChart
                    data={debouncedCashFlowSeries}
                    width={netChartWidth}
                    height={netChartHeight}
                  />
                ) : null}
              </div>
            )}
          </DashboardChartCard>

          <DashboardChartCard
            className={cn('min-w-0')}
            title="Budget Allowance x Reality"
            refreshingLabel="Reviewing allowances..."
            isRefreshing={budgets.transactionsLoading}
          >
            {budgets.isLoading ? (
              <div className={cn('flex-1', 'min-h-0', dashboardLoadingCard)} />
            ) : totalBudget === 0 ? (
              <div className={cn('flex-1', 'min-h-0', 'flex', 'items-center', 'justify-center')}>
                <EmptyState
                  icon={TrendingUp}
                  title="No budgets set"
                  description="Establish your first allowance to see your progress."
                />
              </div>
            ) : debouncedBudgetVsActualData.length === 0 ? (
              <div className={cn('flex-1', 'min-h-0', 'flex', 'items-center', 'justify-center')}>
                <EmptyState
                  icon={TrendingUp}
                  title="No spending for this period."
                  description="The picture sharpens with each transaction."
                />
              </div>
            ) : (
              <div ref={budgetChartRef} className={cn('flex-1', 'min-h-0', 'w-full', 'min-w-0')}>
                {budgetChartWidth > 0 && budgetChartHeight > 0 ? (
                  <BudgetVsActualChart
                    data={debouncedBudgetVsActualData}
                    totalBudget={totalBudget}
                    width={budgetChartWidth}
                    height={budgetChartHeight}
                  />
                ) : null}
              </div>
            )}
          </DashboardChartCard>
        </div>
      </PageLayout>
    </div>
  );
};

export default DashboardPage;
