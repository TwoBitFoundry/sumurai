import { RefreshCcw, TrendingUp } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { cn, EmptyState } from '@/ui/primitives';
import BalancesOverview from '../components/BalancesOverview';
import Card from '../components/ui/Card';
import { useTheme } from '../context/ThemeContext';
import { DashboardCalculator } from '../domain/DashboardCalculator';
import { categoriesToDonut } from '../features/analytics/adapters/chartData';
import { SpendingByCategoryChart } from '../features/analytics/components/SpendingByCategoryChart';
import { TopMerchantsList } from '../features/analytics/components/TopMerchantsList';
import { useAnalytics } from '../features/analytics/hooks/useAnalytics';
import { useNetWorthSeries } from '../features/analytics/hooks/useNetWorthSeries';
import { PageLayout } from '../layouts/PageLayout';
import type { DateRangeKey as DateRange } from '../utils/dateRanges';
import { fmtUSD } from '../utils/format';

const netTooltipFormatter: TooltipProps<number, string>['formatter'] = (value) => {
  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
  return fmtUSD(Number.isFinite(numericValue) ? numericValue : 0);
};

const DashboardPage: React.FC = () => {
  const { colors } = useTheme();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  // Default to past-year for richer data out of the box
  const [dateRange, setDateRange] = useState<DateRange>('past-year');
  const spendingOverviewRef = useRef<HTMLDivElement | null>(null);
  const balancesOverviewRef = useRef<HTMLDivElement | null>(null);
  const [showTimeBar, setShowTimeBar] = useState(false);

  const analytics = useAnalytics(dateRange);
  const analyticsLoading = analytics.loading;
  const analyticsRefreshing = analytics.refreshing;
  const byCat = useMemo(() => categoriesToDonut(analytics.categories), [analytics.categories]);
  const netWorth = useNetWorthSeries(dateRange);
  const netSeries = netWorth.series;
  const netLoading = netWorth.loading;
  const netRefreshing = netWorth.refreshing;
  const netError = netWorth.error;

  useEffect(() => {
    const target = balancesOverviewRef.current;
    if (!target) {
      setShowTimeBar(false);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setShowTimeBar(entry.intersectionRatio < 0.5);
      },
      { threshold: [0, 0.5, 1] }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const monthSpend = analytics.spendingTotal;

  const netDotRenderer = useMemo<((props: DotItemDotProps) => React.ReactNode) | undefined>(() => {
    const n = netSeries?.length || 0;
    const fill = colors.chart.dotFill;
    const stroke = '#10b981';
    if (!n) return undefined;
    const selected = DashboardCalculator.calculateNetDotIndices(netSeries);
    return ({ index, cx, cy }: DotItemDotProps) => {
      if (index == null || cx == null || cy == null) return null;
      if (!selected.has(index)) return null;
      return (
        <circle cx={cx} cy={cy} r={3} stroke={stroke} strokeWidth={1} fill={fill} />
      ) as React.ReactElement<SVGCircleElement>;
    };
  }, [netSeries, colors.chart.dotFill]);

  const netYAxisDomain = useMemo(
    () => DashboardCalculator.calculateNetYAxisDomain(netSeries),
    [netSeries]
  );

  return (
    <div data-testid="dashboard-page">
      <PageLayout
        badge="Dashboard"
        title="Overview of Balances"
        subtitle="Track your assets and liabilities across all connected accounts with real-time balance updates."
        stats={
          <div ref={balancesOverviewRef}>
            <BalancesOverview />
          </div>
        }
      >
        <div className={cn('space-y-8')}>
          <div
            ref={spendingOverviewRef}
            className={cn(
              'grid',
              'grid-cols-1',
              'md:grid-cols-2',
              'lg:grid-cols-3',
              'gap-6',
              'items-stretch'
            )}
          >
            <Card className="h-full">
              <div className={cn('mb-4', 'flex', 'items-center', 'justify-between')}>
                <div>
                  <h3
                    className={cn(
                      'text-base',
                      'font-semibold',
                      'text-slate-900',
                      'dark:text-slate-100'
                    )}
                  >
                    Spending Over Time
                  </h3>
                  <p className={cn('text-xs', 'text-slate-600', 'dark:text-slate-400')}>
                    Breakdown by category
                  </p>
                </div>
                {!analyticsLoading && analyticsRefreshing && (
                  <RefreshCcw
                    aria-label="Refreshing analytics"
                    className={cn(
                      'h-4',
                      'w-4',
                      'text-slate-500',
                      'dark:text-slate-400',
                      'animate-spin'
                    )}
                  />
                )}
              </div>
              {analyticsLoading && (
                <div className={cn('mb-2', 'text-xs', 'text-slate-500', 'dark:text-slate-400')}>
                  Loading analytics...
                </div>
              )}
              <SpendingByCategoryChart
                data={byCat}
                total={monthSpend}
                hoveredCategory={hoveredCategory}
                setHoveredCategory={setHoveredCategory}
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
                          'text-xs',
                          'text-slate-600',
                          'dark:text-slate-400',
                          'mb-2',
                          'font-medium'
                        )}
                      >
                        Top Categories
                      </div>
                      <div className={cn('grid', 'grid-cols-2', 'gap-2')}>
                        {top.map((cat, idx) => {
                          const percentage =
                            categorySum > 0 ? ((cat.value / categorySum) * 100).toFixed(1) : '0.0';
                          const color = colors.chart.primary[idx % colors.chart.primary.length];
                          const isHovered = hoveredCategory === cat.name;
                          return (
                            // biome-ignore lint/a11y/noStaticElementInteractions: visual hover only
                            <div
                              key={`topcard-${cat.name}`}
                              className={`p-2 rounded-lg border transition-all duration-300 ${
                                isHovered
                                  ? 'bg-slate-50 dark:bg-slate-700/40 border-[#93c5fd] dark:border-[#38bdf8] -translate-y-[2px]'
                                  : 'border-slate-200 dark:border-slate-700'
                              }`}
                              onMouseEnter={() => setHoveredCategory(cat.name)}
                              onMouseLeave={() => setHoveredCategory(null)}
                            >
                              <div
                                className={cn('flex', 'items-center', 'gap-2', 'min-w-0', 'mb-1')}
                              >
                                <div
                                  className={cn('w-2.5', 'h-2.5', 'rounded-full', 'flex-shrink-0')}
                                  style={{ backgroundColor: color }}
                                />
                                <span
                                  className={cn(
                                    'text-xs',
                                    'font-medium',
                                    'text-slate-800',
                                    'dark:text-slate-200',
                                    'truncate'
                                  )}
                                >
                                  {cat.name}
                                </span>
                              </div>
                              <div className={cn('flex', 'items-baseline', 'justify-between')}>
                                <div
                                  className={cn(
                                    'text-xs',
                                    'font-semibold',
                                    'text-slate-900',
                                    'dark:text-slate-100'
                                  )}
                                >
                                  {fmtUSD(cat.value)}
                                </div>
                                <div
                                  className={cn(
                                    'text-[10px]',
                                    'text-slate-500',
                                    'dark:text-slate-400'
                                  )}
                                >
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
            </Card>

            <Card className={cn('h-full', 'flex', 'flex-col')}>
              <div className={cn('mb-3', 'flex', 'items-center', 'justify-between')}>
                <div>
                  <h3
                    className={cn(
                      'text-base',
                      'font-semibold',
                      'text-slate-900',
                      'dark:text-slate-100'
                    )}
                  >
                    Top Merchants Over Time
                  </h3>
                  <p className={cn('text-xs', 'text-slate-600', 'dark:text-slate-400')}>
                    Highest spending locations
                  </p>
                </div>
                {!analyticsLoading && analyticsRefreshing && (
                  <RefreshCcw
                    aria-label="Refreshing analytics"
                    className={cn(
                      'h-4',
                      'w-4',
                      'text-slate-500',
                      'dark:text-slate-400',
                      'animate-spin'
                    )}
                  />
                )}
              </div>
              <div className={cn('flex-1', 'overflow-hidden')}>
                <TopMerchantsList
                  merchants={analytics.topMerchants}
                  className={cn('h-full', 'overflow-y-auto', 'pr-1')}
                />
              </div>
            </Card>

            <Card className={cn('h-full', 'flex', 'flex-col')}>
              <div className={cn('mb-4', 'flex', 'items-center', 'justify-between')}>
                <div>
                  <h3
                    className={cn(
                      'text-base',
                      'font-semibold',
                      'text-slate-900',
                      'dark:text-slate-100'
                    )}
                  >
                    Net Worth Over Time
                  </h3>
                  <p className={cn('text-xs', 'text-slate-600', 'dark:text-slate-400')}>
                    Historical asset growth
                  </p>
                </div>
                {!netLoading && netRefreshing && (
                  <RefreshCcw
                    aria-label="Refreshing net worth"
                    className={cn(
                      'h-4',
                      'w-4',
                      'text-slate-500',
                      'dark:text-slate-400',
                      'animate-spin'
                    )}
                  />
                )}
              </div>
              {netLoading ? (
                <div
                  className={cn(
                    'flex-1',
                    'min-h-[220px]',
                    'rounded-xl',
                    'bg-slate-100/60',
                    'dark:bg-slate-900/40',
                    'animate-pulse',
                    'border',
                    'border-slate-200/60',
                    'dark:border-slate-700/60'
                  )}
                />
              ) : netError ? (
                <div
                  className={cn(
                    'flex-1',
                    'min-h-[220px]',
                    'text-sm',
                    'text-rose-600',
                    'dark:text-rose-400'
                  )}
                >
                  {netError}
                </div>
              ) : netSeries.length === 0 ? (
                <div
                  className={cn(
                    'flex-1',
                    'min-h-[220px]',
                    'flex',
                    'items-center',
                    'justify-center'
                  )}
                >
                  <EmptyState
                    icon={TrendingUp}
                    title="No net worth data"
                    description="No data available for this date range"
                  />
                </div>
              ) : (
                <div className={cn('flex-1', 'min-h-[240px]', 'overflow-hidden')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={netSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                            const first = netSeries[0]?.date;
                            const last = netSeries[netSeries.length - 1]?.date;
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
                        formatter={netTooltipFormatter}
                        contentStyle={{ background: colors.chart.tooltipBg }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
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
            </Card>
          </div>
          <div
            className={cn(
              'fixed',
              'left-0',
              'right-0',
              'z-50',
              'flex',
              'justify-center',
              'transition-opacity',
              'duration-300',
              'ease-out',
              showTimeBar ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            style={{ bottom: 24 }}
          >
            <div
              className={cn(
                'flex',
                'gap-2',
                'px-3',
                'py-2',
                'rounded-2xl',
                'bg-white/80',
                'dark:bg-slate-800/80',
                'border',
                'border-slate-200/70',
                'dark:border-slate-700/70',
                'shadow-xl',
                'backdrop-blur-md',
                'ring-1',
                'ring-slate-200/60',
                'dark:ring-slate-700/60'
              )}
            >
              {[
                { key: 'current-month', label: 'Current Month' },
                { key: 'past-2-months', label: '2 Months' },
                { key: 'past-3-months', label: '3 Months' },
                { key: 'past-6-months', label: '6 Months' },
                { key: 'past-year', label: '1 Year' },
                { key: 'all-time', label: '5 Years' },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setDateRange(option.key as DateRange)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    dateRange === option.key
                      ? 'bg-primary-100 dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:-translate-y-[1px]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    </div>
  );
};

export default DashboardPage;
