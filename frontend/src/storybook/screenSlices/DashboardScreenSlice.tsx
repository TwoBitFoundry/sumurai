import { CircleDollarSign, Landmark, PiggyBank, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import HeroStatCard from '@/components/widgets/HeroStatCard';
import { useTheme } from '@/context/ThemeContext';
import { BudgetVsActualChart } from '@/features/analytics/components/BudgetVsActualChart';
import { CashFlowChart } from '@/features/analytics/components/CashFlowChart';
import DashboardChartCard from '@/features/analytics/components/DashboardChartCard';
import { SpendingByCategoryChart } from '@/features/analytics/components/SpendingByCategoryChart';
import { TopMerchantsList } from '@/features/analytics/components/TopMerchantsList';
import { useChartContainerSize } from '@/features/analytics/hooks/useChartContainerSize';
import { PageLayout } from '@/layouts/PageLayout';
import {
  sampleDonutByCategory,
  sampleDonutTotal,
  sampleTopMerchants,
} from '@/storybook/fixtures/analytics';
import { cn, Pill } from '@/ui/primitives';
import {
  dashboardCategoryCard,
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
  radius as uiRadiusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { fmtUSD } from '@/utils/format';

const dashboardLoadingCard = [
  `min-h-[220px] ${uiRadiusRecipes.standard} border animate-pulse`,
  ...semanticBorders.subtle,
  ...semanticSurfaces.mutedChip,
] as const;

const sampleCashFlowSeries = [
  { month: 'Jan', income: 4200, expenses: 2800, net: 1400 },
  { month: 'Feb', income: 3900, expenses: 3100, net: 800 },
  { month: 'Mar', income: 4500, expenses: 2600, net: 1900 },
  { month: 'Apr', income: 4100, expenses: 3400, net: 700 },
  { month: 'May', income: 4600, expenses: 2900, net: 1700 },
  { month: 'Jun', income: 4300, expenses: 3200, net: 1100 },
];

export type DashboardScreenSliceVariant =
  | 'happy'
  | 'analyticsLoading'
  | 'netWorthLoading'
  | 'netWorthError';

export function DashboardScreenSlice(props: { variant: DashboardScreenSliceVariant }) {
  const { colors } = useTheme();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const byCat = sampleDonutByCategory;
  const monthSpend = sampleDonutTotal;

  const analyticsLoading = props.variant === 'analyticsLoading';
  const cashFlowLoading = props.variant === 'netWorthLoading';
  const cashFlowError = props.variant === 'netWorthError' ? 'Unable to load wealth flow.' : null;

  const {
    ref: cashFlowChartRef,
    width: cashFlowWidth,
    height: cashFlowHeight,
  } = useChartContainerSize();
  const {
    ref: budgetChartRef,
    width: budgetChartWidth,
    height: budgetChartHeight,
  } = useChartContainerSize();

  const balancesOverview = (
    <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-5')}>
      <HeroStatCard
        title="Net"
        icon={<TrendingUp />}
        value="$57,440"
        accent="violet"
        minHeightClassName="min-h-0"
        className={cn('h-full', 'col-span-2', 'lg:col-span-1')}
        layout="row"
      />
      <HeroStatCard
        title="Cash"
        icon={<CircleDollarSign />}
        value="$18,420"
        accent="emerald"
        minHeightClassName="min-h-0"
        className="h-full"
        layout="row-tablet"
      />
      <HeroStatCard
        title="Investments"
        icon={<PiggyBank />}
        value="$41,200"
        accent="sky"
        minHeightClassName="min-h-0"
        className="h-full"
        layout="row-tablet"
      />
      <HeroStatCard
        title="Credit"
        icon={<Landmark />}
        value="$2,180"
        accent="rose"
        minHeightClassName="min-h-0"
        className="h-full"
        layout="row-tablet"
      />
      <HeroStatCard
        title="Loans"
        icon={<Landmark />}
        value="$0"
        accent="amber"
        minHeightClassName="min-h-0"
        className="h-full"
        layout="row-tablet"
      />
    </div>
  );

  return (
    <div data-testid="dashboard-page">
      <PageLayout
        title="Appraise the Treasury"
        subtitle="Track your total balances and net worth across accounts."
        stats={balancesOverview}
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
            isRefreshing={false}
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
                    return byCat.slice(0, 5).map((cat) => {
                      const percentage =
                        categorySum > 0 ? ((cat.value / categorySum) * 100).toFixed(1) : '0.0';
                      const isHovered = hoveredCategory === cat.name;
                      return (
                        <button
                          key={`topcard-${cat.name}`}
                          type="button"
                          className={cn('p-2', dashboardCategoryCard.shell)}
                          style={isHovered ? { borderColor: colors.chart.primary[0] } : undefined}
                          onMouseEnter={() => setHoveredCategory(cat.name)}
                          onMouseLeave={() => setHoveredCategory(null)}
                          onClick={() => setHoveredCategory(cat.name)}
                        >
                          <div className={cn('flex', 'items-center', 'justify-between', 'gap-2')}>
                            <Pill
                              categoryName={cat.categoryKey}
                              className={cn('min-w-0', 'truncate')}
                            >
                              {cat.name}
                            </Pill>
                            <div className={cn('flex', 'items-baseline', 'gap-2', 'shrink-0')}>
                              <span
                                className={cn(
                                  uiTypographyRecipes.cardTitle,
                                  uiTextRecipes.primary,
                                  'tabular-nums'
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
            isRefreshing={false}
            bodyClassName={cn('overflow-hidden')}
          >
            <div className={cn('h-full', 'overflow-hidden')}>
              <TopMerchantsList
                merchants={sampleTopMerchants}
                className={cn('h-full', 'overflow-y-auto')}
              />
            </div>
          </DashboardChartCard>

          <DashboardChartCard
            className={cn('min-w-0')}
            title="Wealth flow"
            refreshingLabel="Tracing the flow..."
            isRefreshing={false}
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
            ) : (
              <div ref={cashFlowChartRef} className={cn('flex-1', 'min-h-0', 'w-full', 'min-w-0')}>
                {cashFlowWidth > 0 && cashFlowHeight > 0 ? (
                  <CashFlowChart
                    data={sampleCashFlowSeries}
                    width={cashFlowWidth}
                    height={cashFlowHeight}
                  />
                ) : null}
              </div>
            )}
          </DashboardChartCard>

          <DashboardChartCard
            className={cn('min-w-0')}
            title="Budget vs reality"
            refreshingLabel="Reviewing allowances..."
            isRefreshing={false}
          >
            <div ref={budgetChartRef} className={cn('flex-1', 'min-h-0', 'w-full', 'min-w-0')}>
              {budgetChartWidth > 0 && budgetChartHeight > 0 ? (
                <BudgetVsActualChart
                  data={[
                    { month: 'Jan', expenses: 620 },
                    { month: 'Feb', expenses: 490 },
                    { month: 'Mar', expenses: 780 },
                    { month: 'Apr', expenses: 920 },
                    { month: 'May', expenses: 710 },
                    { month: 'Jun', expenses: 835 },
                  ]}
                  totalBudget={850}
                  width={budgetChartWidth}
                  height={budgetChartHeight}
                />
              ) : null}
            </div>
          </DashboardChartCard>
        </div>
      </PageLayout>
    </div>
  );
}
