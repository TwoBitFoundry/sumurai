import { CircleDollarSign, Landmark, PiggyBank, TrendingUp } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
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
import HeroStatCard from '@/components/widgets/HeroStatCard';
import { useTheme } from '@/context/ThemeContext';
import { DashboardCalculator } from '@/domain/DashboardCalculator';
import DashboardChartCard from '@/features/analytics/components/DashboardChartCard';
import { SpendingByCategoryChart } from '@/features/analytics/components/SpendingByCategoryChart';
import { TopMerchantsList } from '@/features/analytics/components/TopMerchantsList';
import { PageLayout } from '@/layouts/PageLayout';
import {
  sampleDonutByCategory,
  sampleDonutTotal,
  sampleTopMerchants,
} from '@/storybook/fixtures/analytics';
import { sampleNetWorthSeries } from '@/storybook/fixtures/netWorth';
import { Button, cn } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import { fmtUSD } from '@/utils/format';
import { dashboardTokenRecipes } from '@/views/tokenRecipes';

const DATE_RANGE_OPTIONS = [
  { key: 'current-month', label: 'Current Month' },
  { key: 'past-2-months', label: '2 Months' },
  { key: 'past-3-months', label: '3 Months' },
  { key: 'past-6-months', label: '6 Months' },
  { key: 'past-year', label: '1 Year' },
  { key: 'all-time', label: '5 Years' },
] as const;

const netTooltipFormatter: TooltipProps<number, string>['formatter'] = (value) => {
  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
  return fmtUSD(Number.isFinite(numericValue) ? numericValue : 0);
};

export type DashboardScreenSliceVariant =
  | 'happy'
  | 'analyticsLoading'
  | 'netWorthLoading'
  | 'netWorthError';

export function DashboardScreenSlice(props: { variant: DashboardScreenSliceVariant }) {
  const { colors } = useTheme();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [dateRange, setDateRange] =
    useState<(typeof DATE_RANGE_OPTIONS)[number]['key']>('current-month');

  const byCat = sampleDonutByCategory;
  const monthSpend = sampleDonutTotal;
  const netSeries = sampleNetWorthSeries;

  const analyticsLoading = props.variant === 'analyticsLoading';
  const netLoading = props.variant === 'netWorthLoading';
  const netError = props.variant === 'netWorthError' ? 'Unable to load net worth series.' : null;

  const netYAxisDomain = DashboardCalculator.calculateNetYAxisDomain(netSeries);

  const netDotRenderer = useMemo<((props: DotItemDotProps) => React.ReactNode) | undefined>(() => {
    const n = netSeries.length || 0;
    const fill = colors.chart.dotFill;
    const stroke = colors.semantic.cash;
    if (!n || netLoading || netError) return undefined;
    const selected = DashboardCalculator.calculateNetDotIndices(netSeries);
    return ({ index, cx, cy }: DotItemDotProps) => {
      if (index == null || cx == null || cy == null) return null;
      if (!selected.has(index)) return null;
      return (
        <circle cx={cx} cy={cy} r={3} stroke={stroke} strokeWidth={1} fill={fill} />
      ) as React.ReactElement<SVGCircleElement>;
    };
  }, [colors.chart.dotFill, colors.semantic.cash, netLoading, netError]);

  const balancesOverview = (
    <div
      className={cn('grid', 'gap-3', '[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]')}
    >
      <HeroStatCard
        index={1}
        title="Cash"
        icon={<CircleDollarSign className="h-4 w-4" />}
        value="$18,420"
        accent="emerald"
        minHeightClassName="min-h-0"
      />
      <HeroStatCard
        index={2}
        title="Credit"
        icon={<Landmark className="h-4 w-4" />}
        value="$2,180"
        accent="rose"
        minHeightClassName="min-h-0"
      />
      <HeroStatCard
        index={3}
        title="Investments"
        icon={<PiggyBank className="h-4 w-4" />}
        value="$41,200"
        accent="sky"
        minHeightClassName="min-h-0"
      />
      <HeroStatCard
        index={4}
        title="Net worth"
        icon={<TrendingUp className="h-4 w-4" />}
        value="$57,440"
        accent="violet"
        minHeightClassName="min-h-0"
      />
    </div>
  );

  return (
    <div data-testid="dashboard-page">
      <PageLayout
        badge="Dashboard"
        title="Overview of Balances"
        subtitle="Track your assets and liabilities across all connected accounts with real-time balance updates."
        stats={balancesOverview}
      >
        <div className={cn('space-y-8')}>
          <div
            className={cn(
              'grid',
              'grid-cols-1',
              'md:grid-cols-2',
              'lg:grid-cols-3',
              'gap-6',
              'items-stretch'
            )}
          >
            <DashboardChartCard
              title="Spending Over Time"
              description="Breakdown by category"
              refreshingLabel="Refreshing analytics"
              isRefreshing={false}
            >
              {analyticsLoading && (
                <div
                  className={cn('mb-2', designTokens.typography.caption, designTokens.text.muted)}
                >
                  Loading analytics...
                </div>
              )}
              <SpendingByCategoryChart
                data={byCat}
                total={monthSpend}
                hoveredCategory={hoveredCategory}
                setHoveredCategory={setHoveredCategory}
              />
              {!analyticsLoading && byCat.length > 0 ? (
                <div className="mt-4">
                  <div
                    className={cn(
                      designTokens.typography.caption,
                      designTokens.text.label,
                      'mb-2',
                      'font-medium'
                    )}
                  >
                    Top Categories
                  </div>
                  <div className={cn('grid', 'grid-cols-2', 'gap-2')}>
                    {byCat.slice(0, 4).map((cat, idx) => {
                      const categorySum = byCat.reduce(
                        (sum, c) => sum + (Number.isFinite(c.value) ? c.value : 0),
                        0
                      );
                      const percentage =
                        categorySum > 0 ? ((cat.value / categorySum) * 100).toFixed(1) : '0.0';
                      const color = colors.chart.primary[idx % colors.chart.primary.length];
                      const isHovered = hoveredCategory === cat.name;
                      return (
                        // biome-ignore lint/a11y/noStaticElementInteractions: mirrors dashboard hover sync with donut
                        <div
                          key={`topcard-${cat.name}`}
                          className={cn(
                            'p-2',
                            isHovered
                              ? dashboardTokenRecipes.cardShellActive
                              : dashboardTokenRecipes.cardShell
                          )}
                          style={isHovered ? { borderColor: colors.chart.primary[0] } : undefined}
                          onMouseEnter={() => setHoveredCategory(cat.name)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        >
                          <div className={cn('flex', 'items-center', 'gap-2', 'min-w-0', 'mb-1')}>
                            <div
                              className={cn('w-2.5', 'h-2.5', 'rounded-full', 'flex-shrink-0')}
                              style={{ backgroundColor: color }}
                            />
                            <span
                              className={cn(
                                designTokens.typography.caption,
                                'font-medium',
                                designTokens.text.body,
                                'truncate'
                              )}
                            >
                              {cat.name}
                            </span>
                          </div>
                          <div className={cn('flex', 'items-baseline', 'justify-between')}>
                            <div
                              className={cn(
                                designTokens.typography.caption,
                                'font-semibold',
                                designTokens.text.primary
                              )}
                            >
                              {fmtUSD(cat.value)}
                            </div>
                            <div className={cn('text-[10px]', designTokens.text.muted)}>
                              {percentage}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </DashboardChartCard>

            <DashboardChartCard
              title="Top Merchants Over Time"
              description="Highest spending locations"
              refreshingLabel="Refreshing analytics"
              isRefreshing={false}
              bodyClassName={cn('overflow-hidden')}
            >
              <div className={cn('h-full', 'overflow-hidden')}>
                <TopMerchantsList
                  merchants={sampleTopMerchants}
                  className={cn('h-full', 'overflow-y-auto', 'pr-1')}
                />
              </div>
            </DashboardChartCard>

            <DashboardChartCard
              title="Net Worth Over Time"
              description="Historical asset growth"
              refreshingLabel="Refreshing net worth"
              isRefreshing={false}
            >
              {netLoading ? (
                <div className={cn('flex-1', dashboardTokenRecipes.loadingCard)} />
              ) : netError ? (
                <div
                  className={cn(
                    'flex-1',
                    'min-h-[220px]',
                    designTokens.typography.body,
                    designTokens.text.danger
                  )}
                >
                  {netError}
                </div>
              ) : (
                <div className={cn('h-[240px]', 'w-full', 'min-w-0', 'overflow-hidden')}>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={netSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="netGradientStory" x1="0" y1="0" x2="0" y2="1">
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
                          const d = new Date(value);
                          if (!Number.isFinite(d.getTime())) return value;
                          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
                          if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(0)}m`;
                          if (n >= 1e3) return `${sign}$${(n / 1e3).toFixed(0)}k`;
                          return `${sign}$${Number(n).toFixed(0)}`;
                        }}
                      />
                      <Tooltip
                        formatter={netTooltipFormatter}
                        contentStyle={{ background: colors.chart.tooltipBg }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={colors.semantic.cash}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#netGradientStory)"
                        dot={netDotRenderer}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashboardChartCard>
          </div>

          <div
            className={cn(
              'fixed',
              'left-0',
              'right-0',
              'z-50',
              'flex',
              'justify-center',
              'pointer-events-none',
              'opacity-100'
            )}
            style={{ bottom: 24 }}
          >
            <div className={cn('pointer-events-auto', dashboardTokenRecipes.floatingRangeShell)}>
              {DATE_RANGE_OPTIONS.map((option) => (
                <Button
                  type="button"
                  key={option.key}
                  onClick={() => setDateRange(option.key)}
                  variant={dateRange === option.key ? 'tabActive' : 'tab'}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium normal-case transition-all duration-200"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    </div>
  );
}
