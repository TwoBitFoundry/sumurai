import { TrendingUp } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';

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
  `min-h-[220px] ${uiRadiusRecipes.standard} border animate-pulse`,
  ...semanticBorders.subtle,
  ...semanticSurfaces.mutedChip,
] as const;

let lastSpendingByCategoryAnimationKey = '';

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

  const spendingByCategoryAnimationKey = `${dateRange}-${analytics.cacheKey}`;
  const shouldAnimateSpendingByCategory =
    spendingByCategoryAnimationKey !== lastSpendingByCategoryAnimationKey;

  useEffect(() => {
    lastSpendingByCategoryAnimationKey = spendingByCategoryAnimationKey;
  }, [spendingByCategoryAnimationKey]);

  const monthSpend = analytics.spendingTotal;
  const handleCategoryHover = (name: string | null) => {
    setHoveredCategory(name);
  };

  const {
    ref: netChartRef,
    width: netChartWidth,
    height: netChartHeight,
  } = useChartContainerSize();

  return (
    <div data-testid="dashboard-page">
      <PageLayout
        badge="Dashboard"
        title="Balances Overview"
        subtitle="View balances, spending, top merchants, and net worth across linked accounts."
        stats={<BalancesOverview />}
      >
        <div
          className={cn(
            'grid',
            'w-full',
            'min-w-0',
            'max-w-full',
            'grid-cols-1',
            'md:grid-cols-2',
            'lg:grid-cols-3',
            'gap-4',
            'md:gap-6',
            'items-stretch',
            'auto-rows-fr'
          )}
        >
          <DashboardChartCard
            className="min-w-0"
            title="Spending Over Time"
            description="Breakdown by category"
            refreshingLabel="Refreshing analytics"
            isRefreshing={!analyticsLoading && analyticsRefreshing}
          >
            {analyticsLoading && (
              <div className={cn('mb-2', uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                Loading analytics...
              </div>
            )}
            <div
              className={cn(
                'grid',
                'flex-1',
                'min-h-0',
                'gap-4',
                'grid-cols-1',
                'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
                'lg:grid-cols-1',
                'items-center'
              )}
            >
              <SpendingByCategoryChart
                data={byCat}
                total={monthSpend}
                hoveredCategory={hoveredCategory}
                setHoveredCategory={setHoveredCategory}
                animated={shouldAnimateSpendingByCategory}
              />
              <div className={cn('min-w-0', 'w-full')}>
                {(() => {
                  const categories = byCat;
                  if (!categories || categories.length === 0) return null;
                  const categorySum = categories.reduce(
                    (sum, c) => sum + (Number.isFinite(c.value) ? c.value : 0),
                    0
                  );
                  const top = categories.slice(0, 4);
                  return (
                    <div>
                      <div
                        className={cn(
                          uiTypographyRecipes.label,
                          uiTextRecipes.label,
                          'mb-2',
                          'font-medium'
                        )}
                      >
                        Top Categories
                      </div>
                      <div className={cn('grid', 'grid-cols-2', 'gap-2')}>
                        {top.map((cat) => {
                          const percentage =
                            categorySum > 0 ? ((cat.value / categorySum) * 100).toFixed(1) : '0.0';
                          const isHovered = hoveredCategory === cat.name;
                          return (
                            <button
                              key={`topcard-${cat.name}`}
                              type="button"
                              className={cn('p-2', dashboardCategoryCard.shell)}
                              style={
                                isHovered ? { borderColor: colors.chart.primary[0] } : undefined
                              }
                              onMouseEnter={() => handleCategoryHover(cat.name)}
                              onMouseLeave={() => handleCategoryHover(null)}
                              onClick={() => handleCategoryHover(cat.name)}
                            >
                              <div className={cn('mb-1')}>
                                <Pill
                                  categoryName={cat.categoryKey}
                                  accentIndexByName={accentIndexByName}
                                  className={cn('max-w-full')}
                                >
                                  {cat.name}
                                </Pill>
                              </div>
                              <div className={cn('flex', 'items-baseline', 'justify-between')}>
                                <div
                                  className={cn(
                                    uiTypographyRecipes.bodyStrong,
                                    uiTextRecipes.primary
                                  )}
                                >
                                  {fmtUSD(cat.value)}
                                </div>
                                <div
                                  className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}
                                >
                                  {percentage}%
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </DashboardChartCard>

          <DashboardChartCard
            className="min-w-0"
            title="Top Merchants Over Time"
            description="Highest spending locations"
            refreshingLabel="Refreshing analytics"
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
            className="min-w-0"
            title="Cash flow"
            description="Income vs expenses"
            refreshingLabel="Refreshing cash flow"
            isRefreshing={!cashFlowLoading && cashFlowRefreshing}
          >
            {cashFlowLoading ? (
              <div className={cn('flex-1', 'min-h-0', dashboardLoadingCard)} />
            ) : cashFlowError ? (
              <div
                className={cn(
                  'flex-1',
                  'min-h-0',
                  'min-h-[220px]',
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
                  'min-h-[220px]',
                  'flex',
                  'items-center',
                  'justify-center'
                )}
              >
                <EmptyState
                  icon={TrendingUp}
                  title="No cash flow data"
                  description="No transactions in this period."
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

          {totalBudget > 0 && (
            <DashboardChartCard
              className="min-w-0"
              title="Budget vs Actual"
              description="Monthly spending against budget"
              refreshingLabel="Refreshing budget data"
              isRefreshing={budgets.transactionsLoading}
              headerAction={{
                label: 'View budgets',
                onClick: () => window.location.href = '/budgets',
              }}
            >
              {budgets.isLoading ? (
                <div className={cn('flex-1', 'min-h-0', dashboardLoadingCard)} />
              ) : budgetVsActualData.length === 0 ? (
                <div
                  className={cn(
                    'flex-1',
                    'min-h-0',
                    'min-h-[220px]',
                    'flex',
                    'items-center',
                    'justify-center'
                  )}
                >
                  <EmptyState
                    icon={TrendingUp}
                    title="No spending data"
                    description="Budget data will appear when you have transactions."
                  />
                </div>
              ) : (
                <div ref={netChartRef} className={cn('flex-1', 'min-h-0', 'w-full', 'min-w-0')}>
                  {netChartWidth > 0 && netChartHeight > 0 ? (
                    <BudgetVsActualChart
                      data={budgetVsActualData}
                      totalBudget={totalBudget}
                      width={netChartWidth}
                      height={netChartHeight}
                    />
                  ) : null}
                </div>
              )}
            </DashboardChartCard>
          )}
        </div>
      </PageLayout>
    </div>
  );
};

export default DashboardPage;
