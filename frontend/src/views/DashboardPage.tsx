import { TrendingUp } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { TooltipProps } from 'recharts';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DotItemDotProps } from 'recharts/types/util/types';
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
import {
  ChartGlassTooltip,
  chartTooltipRechartsProps,
} from '../features/analytics/components/ChartGlassTooltip';
import DashboardChartCard from '../features/analytics/components/DashboardChartCard';
import { SpendingByCategoryChart } from '../features/analytics/components/SpendingByCategoryChart';
import { TopMerchantsList } from '../features/analytics/components/TopMerchantsList';
import { useAnalytics } from '../features/analytics/hooks/useAnalytics';
import { useDebouncedChartRecalc } from '../features/analytics/hooks/useDebouncedChartRecalc';
import { useNetWorthSeries } from '../features/analytics/hooks/useNetWorthSeries';
import { useCategories } from '../features/transactions/hooks/useCategories';
import { PageLayout } from '../layouts/PageLayout';
import type { DateRangeKey as DateRange } from '../utils/dateRanges';
import { fmtUSD } from '../utils/format';

const dashboardLoadingCard = [
  `min-h-[220px] ${uiRadiusRecipes.standard} border animate-pulse`,
  ...semanticBorders.subtle,
  ...semanticSurfaces.mutedChip,
] as const;

const netTooltipFormatter: TooltipProps<number, string>['formatter'] = (value) => {
  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
  return fmtUSD(Number.isFinite(numericValue) ? numericValue : 0);
};

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
  const byCat = useMemo(() => categoriesToDonut(analytics.categories), [analytics.categories]);
  const netWorth = useNetWorthSeries(dateRange);
  const netSeries = netWorth.series;
  const debouncedNetSeries = useDebouncedChartRecalc(netSeries);
  const netLoading = netWorth.loading;
  const netRefreshing = netWorth.refreshing;
  const netError = netWorth.error;
  const spendingByCategoryAnimationKey = `${dateRange}-${analytics.cacheKey}`;
  const shouldAnimateSpendingByCategory =
    spendingByCategoryAnimationKey !== lastSpendingByCategoryAnimationKey;

  useEffect(() => {
    lastSpendingByCategoryAnimationKey = spendingByCategoryAnimationKey;
  }, [spendingByCategoryAnimationKey]);

  const monthSpend = analytics.spendingTotal;

  const netDotRenderer = useMemo<((props: DotItemDotProps) => React.ReactNode) | undefined>(() => {
    const n = debouncedNetSeries?.length || 0;
    const fill = colors.chart.dotFill;
    const stroke = colors.semantic.cash;
    if (!n) return undefined;
    const selected = DashboardCalculator.calculateNetDotIndices(debouncedNetSeries);
    return ({ index, cx, cy }: DotItemDotProps) => {
      if (index == null || cx == null || cy == null) return null;
      if (!selected.has(index)) return null;
      return (
        <circle cx={cx} cy={cy} r={3} stroke={stroke} strokeWidth={1} fill={fill} />
      ) as React.ReactElement<SVGCircleElement>;
    };
  }, [debouncedNetSeries, colors.chart.dotFill, colors.semantic.cash]);

  const netYAxisDomain = useMemo(
    () => DashboardCalculator.calculateNetYAxisDomain(debouncedNetSeries),
    [debouncedNetSeries]
  );

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
            'items-stretch'
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
            <SpendingByCategoryChart
              data={byCat}
              total={monthSpend}
              hoveredCategory={hoveredCategory}
              setHoveredCategory={setHoveredCategory}
              animated={shouldAnimateSpendingByCategory}
            />
            <div className="mt-4">
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
                          // biome-ignore lint/a11y/noStaticElementInteractions: visual hover only
                          <div
                            key={`topcard-${cat.name}`}
                            className={cn('p-2', dashboardCategoryCard.shell)}
                            style={isHovered ? { borderColor: colors.chart.primary[0] } : undefined}
                            onMouseEnter={() => setHoveredCategory(cat.name)}
                            onMouseLeave={() => setHoveredCategory(null)}
                          >
                            <div className={cn('mb-1')}>
                              <Pill
                                categoryName={cat.name}
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
                              <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                                {percentage}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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
            title="Net Worth Over Time"
            description="Historical asset growth"
            refreshingLabel="Refreshing net worth"
            isRefreshing={!netLoading && netRefreshing}
          >
            {netLoading ? (
              <div className={cn('flex-1', dashboardLoadingCard)} />
            ) : netError ? (
              <div
                className={cn(
                  'flex-1',
                  'min-h-[220px]',
                  uiTypographyRecipes.body,
                  uiTextRecipes.danger
                )}
              >
                {netError}
              </div>
            ) : netSeries.length === 0 ? (
              <div
                className={cn('flex-1', 'min-h-[220px]', 'flex', 'items-center', 'justify-center')}
              >
                <EmptyState
                  icon={TrendingUp}
                  title="No net worth data"
                  description="No data available for this date range"
                />
              </div>
            ) : (
              <div className={cn('flex-1', 'h-full', 'w-full', 'min-w-0', 'overflow-visible')}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={debouncedNetSeries}
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.semantic.cash} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={colors.semantic.cash} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.chart.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: colors.chart.axis, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                      tickFormatter={(value: string) => {
                        try {
                          if (!value) return '';
                          const first = debouncedNetSeries[0]?.date;
                          const last = debouncedNetSeries[debouncedNetSeries.length - 1]?.date;
                          const d = new Date(value);
                          const spanDays =
                            first && last
                              ? Math.max(
                                  1,
                                  Math.round(
                                    (new Date(last).getTime() - new Date(first).getTime()) /
                                      86400000
                                  )
                                )
                              : 0;
                          if (!Number.isFinite(d.getTime())) return value;
                          if (spanDays && spanDays <= 92) {
                            return d.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            });
                          }
                          const mm = d.toLocaleString('en-US', { month: 'short' });
                          const yy = d.toLocaleString('en-US', { year: '2-digit' });
                          return `${mm} ’${yy}`;
                        } catch {
                          return value;
                        }
                      }}
                    />
                    <YAxis
                      tick={{ fill: colors.chart.axis, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      domain={netYAxisDomain ?? ['auto', 'auto']}
                      tickFormatter={(v) => {
                        const n = Math.abs(Number(v));
                        const sign = Number(v) < 0 ? '-' : '';
                        if (n >= 1e9) return `${sign}$${(n / 1e9).toFixed(0)}b`;
                        if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(0)}m`;
                        if (n >= 1e3) return `${sign}$${(n / 1e3).toFixed(0)}k`;
                        return `${sign}$${Number(n).toFixed(0)}`;
                      }}
                    />
                    <Tooltip
                      content={(tooltipProps) => (
                        <ChartGlassTooltip
                          {...tooltipProps}
                          formatter={netTooltipFormatter}
                          valueClassName={uiTextRecipes.success}
                        />
                      )}
                      {...chartTooltipRechartsProps}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={colors.semantic.cash}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#netGradient)"
                      dot={netDotRenderer}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardChartCard>
        </div>
      </PageLayout>
    </div>
  );
};

export default DashboardPage;
