import { CalendarClock, CreditCard, RefreshCcw, TrendingUp } from 'lucide-react';
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
import { cn, EmptyState, InfoTooltip } from '@/ui/primitives';
import BalancesOverview from '../components/BalancesOverview';
import MonthYearSelector from '../components/MonthYearSelector';
import Card from '../components/ui/Card';
import { useTheme } from '../context/ThemeContext';
import { DashboardCalculator } from '../domain/DashboardCalculator';
import { categoriesToDonut } from '../features/analytics/adapters/chartData';
import { SpendingByCategoryChart } from '../features/analytics/components/SpendingByCategoryChart';
import { TopMerchantsList } from '../features/analytics/components/TopMerchantsList';
import { useAnalytics } from '../features/analytics/hooks/useAnalytics';
import { useNetWorthSeries } from '../features/analytics/hooks/useNetWorthSeries';
import { useAccountFilter } from '../hooks/useAccountFilter';
import { useCurrency } from '../hooks/useCurrency';
import { PageLayout } from '../layouts/PageLayout';
import { TransactionService } from '../services/TransactionService';
import type { Transaction } from '../types/api';
import { formatDateOnly } from '../utils/dateOnly';
import type { MonthYearSelection } from '../utils/dateRanges';

const getSelectedMonthWindow = (period: MonthYearSelection) => {
  const isFullYear = period.month === null;
  const start = new Date(0);
  start.setFullYear(period.year, isFullYear ? 0 : period.month, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(0);
  end.setFullYear(period.year, isFullYear ? 12 : period.month + 1, 0);
  end.setHours(0, 0, 0, 0);
  return {
    start,
    horizonDays: Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000)),
  };
};

interface DashboardPageProps {
  period: MonthYearSelection;
  onPeriodChange: (period: MonthYearSelection) => void;
  onCategorySelect?: (category: string) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  period,
  onPeriodChange,
  onCategorySelect,
}) => {
  const { colors } = useTheme();
  const { convert, format, formatConverted } = useCurrency();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [chargeTransactions, setChargeTransactions] = useState<Transaction[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);
  const [chargesError, setChargesError] = useState<string | null>(null);
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const analytics = useAnalytics(period);
  const analyticsLoading = analytics.loading;
  const analyticsRefreshing = analytics.refreshing;
  const byCat = useMemo(() => categoriesToDonut(analytics.categories), [analytics.categories]);
  const netWorth = useNetWorthSeries();
  const netSeries = netWorth.series;
  const displayNetSeries = useMemo(
    () => netSeries.map((point) => ({ ...point, value: convert(point.value) })),
    [convert, netSeries]
  );
  const netLoading = netWorth.loading;
  const netRefreshing = netWorth.refreshing;
  const netError = netWorth.error;
  const netTooltipFormatter: TooltipProps<number, string>['formatter'] = (value) => {
    const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
    return formatConverted(Number.isFinite(numericValue) ? numericValue : 0);
  };

  const monthSpend = analytics.spendingTotal;
  const selectedMonthWindow = useMemo(() => getSelectedMonthWindow(period), [period]);
  const upcomingCharges = useMemo(
    () =>
      DashboardCalculator.predictUpcomingCharges(
        chargeTransactions,
        selectedMonthWindow.start,
        selectedMonthWindow.horizonDays
      ),
    [chargeTransactions, selectedMonthWindow]
  );
  const totalUpcomingCharges = useMemo(
    () => upcomingCharges.reduce((sum, charge) => sum + charge.amount, 0),
    [upcomingCharges]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadChargeTransactions() {
      if (accountsLoading) return;

      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        setChargeTransactions([]);
        setChargesError(null);
        setChargesLoading(false);
        return;
      }

      setChargesLoading(true);
      setChargesError(null);

      try {
        const txns = await TransactionService.getTransactions(
          !isAllAccountsSelected && selectedAccountIds.length > 0
            ? { accountIds: selectedAccountIds }
            : undefined
        );

        if (!cancelled) {
          setChargeTransactions(txns);
        }
      } catch {
        if (!cancelled) {
          setChargeTransactions([]);
          setChargesError('Unable to predict upcoming charges right now.');
        }
      } finally {
        if (!cancelled) {
          setChargesLoading(false);
        }
      }
    }

    loadChargeTransactions();

    return () => {
      cancelled = true;
    };
  }, [accountsLoading, allAccountIds.length, isAllAccountsSelected, selectedAccountIds]);

  const netDotRenderer = useMemo<((props: DotItemDotProps) => React.ReactNode) | undefined>(() => {
    const n = displayNetSeries?.length || 0;
    const fill = colors.chart.dotFill;
    const stroke = '#10b981';
    if (!n) return undefined;
    const selected = DashboardCalculator.calculateNetDotIndices(displayNetSeries);
    return ({ index, cx, cy }: DotItemDotProps) => {
      if (index == null || cx == null || cy == null) return null;
      if (!selected.has(index)) return null;
      return (
        <circle cx={cx} cy={cy} r={3} stroke={stroke} strokeWidth={1} fill={fill} />
      ) as React.ReactElement<SVGCircleElement>;
    };
  }, [displayNetSeries, colors.chart.dotFill]);

  const netYAxisDomain = useMemo(
    () => DashboardCalculator.calculateNetYAxisDomain(displayNetSeries),
    [displayNetSeries]
  );

  return (
    <div data-testid="dashboard-page">
      <PageLayout
        badge="Dashboard"
        title="Assets vs Liabilities"
        subtitle="Assets appear above zero, debt appears below zero, and net worth is the difference."
        stats={
          <div>
            <BalancesOverview />
          </div>
        }
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
            <Card className="h-full">
              <div className={cn('mb-4', 'flex', 'items-center', 'justify-between')}>
                <div>
                  <div className={cn('flex', 'items-center', 'gap-1.5')}>
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
                    <InfoTooltip
                      content="Pending transactions are excluded from dashboard totals. Only settled (posted) spending is shown."
                      ariaLabel="Pending transactions spending explanation"
                    />
                  </div>
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
                onCategorySelect={onCategorySelect}
              />
              <div className="mt-4">
                {(() => {
                  const categories = byCat;
                  if (!categories || categories.length === 0) return null;
                  const categorySum = categories.reduce(
                    (sum, c) => sum + (Number.isFinite(c.value) ? c.value : 0),
                    0
                  );
                  const top = categories.slice(0, 6);
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
                            <button
                              type="button"
                              key={`topcard-${cat.name}`}
                              className={`p-2 rounded-lg border text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:focus-visible:ring-sky-400 ${
                                isHovered
                                  ? 'bg-slate-50 dark:bg-slate-700/40 border-[#93c5fd] dark:border-[#38bdf8] -translate-y-[2px]'
                                  : 'border-slate-200 dark:border-slate-700'
                              }`}
                              aria-label={`Show ${cat.name} transactions`}
                              title={`Show ${cat.name} transactions`}
                              onMouseEnter={() => setHoveredCategory(cat.name)}
                              onMouseLeave={() => setHoveredCategory(null)}
                              onFocus={() => setHoveredCategory(cat.name)}
                              onBlur={() => setHoveredCategory(null)}
                              onClick={() => onCategorySelect?.(cat.name)}
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
                                  {format(cat.value)}
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
                            </button>
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
              ) : displayNetSeries.length === 0 ? (
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
                    <AreaChart
                      data={displayNetSeries}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    >
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
                            const first = displayNetSeries[0]?.date;
                            const last = displayNetSeries[displayNetSeries.length - 1]?.date;
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
                          const span = netYAxisDomain
                            ? Math.abs(netYAxisDomain[1] - netYAxisDomain[0])
                            : 0;
                          const digits = span > 0 && span < 2_000_000 ? 2 : 1;
                          const compact = new Intl.NumberFormat('en-US', {
                            notation: 'compact',
                            maximumFractionDigits: digits,
                          }).format(n);
                          return `${sign}${compact}`;
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
          <Card>
            <div className={cn('mb-5', 'flex', 'items-start', 'justify-between', 'gap-4')}>
              <div>
                <h3
                  className={cn(
                    'text-base',
                    'font-semibold',
                    'text-slate-900',
                    'dark:text-slate-100'
                  )}
                >
                  Upcoming Charges
                </h3>
                <p className={cn('text-xs', 'text-slate-600', 'dark:text-slate-400')}>
                  Predicted from recurring transaction patterns
                </p>
              </div>
              <div className={cn('text-right')}>
                <div className={cn('text-xs', 'text-slate-500', 'dark:text-slate-400')}>
                  Through month end
                </div>
                <div
                  className={cn(
                    'text-lg',
                    'font-semibold',
                    'text-slate-900',
                    'dark:text-slate-100'
                  )}
                >
                  {format(totalUpcomingCharges)}
                </div>
              </div>
            </div>
            {chargesLoading ? (
              <div
                className={cn('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4', 'gap-3')}
              >
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={cn(
                      'h-24',
                      'rounded-lg',
                      'bg-slate-100/70',
                      'dark:bg-slate-900/40',
                      'animate-pulse',
                      'border',
                      'border-slate-200/60',
                      'dark:border-slate-700/60'
                    )}
                  />
                ))}
              </div>
            ) : chargesError ? (
              <div className={cn('text-sm', 'text-rose-600', 'dark:text-rose-400')}>
                {chargesError}
              </div>
            ) : upcomingCharges.length === 0 ? (
              <div className={cn('py-6')}>
                <EmptyState
                  icon={CalendarClock}
                  title="No upcoming charges found"
                  description="Recurring charges will appear here after a few matching transactions."
                />
              </div>
            ) : (
              <div
                className={cn('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4', 'gap-3')}
              >
                {upcomingCharges.map((charge) => (
                  <div
                    key={`${charge.merchant}-${charge.nextDate}`}
                    className={cn(
                      'rounded-lg',
                      'border',
                      'border-slate-200',
                      'dark:border-slate-700',
                      'p-4',
                      'bg-white/60',
                      'dark:bg-slate-900/30'
                    )}
                  >
                    <div className={cn('flex', 'items-start', 'justify-between', 'gap-3')}>
                      <div className={cn('min-w-0')}>
                        <div
                          className={cn(
                            'text-sm',
                            'font-semibold',
                            'text-slate-900',
                            'dark:text-slate-100',
                            'truncate'
                          )}
                        >
                          {charge.merchant}
                        </div>
                        <div
                          className={cn('mt-1', 'text-xs', 'text-slate-500', 'dark:text-slate-400')}
                        >
                          {formatDateOnly(charge.nextDate)}
                        </div>
                      </div>
                      <CreditCard className={cn('h-4', 'w-4', 'text-slate-400', 'shrink-0')} />
                    </div>
                    <div className={cn('mt-4', 'flex', 'items-end', 'justify-between', 'gap-3')}>
                      <div>
                        <div
                          className={cn(
                            'text-lg',
                            'font-semibold',
                            'text-slate-900',
                            'dark:text-slate-100'
                          )}
                        >
                          {format(charge.amount)}
                        </div>
                        <div className={cn('text-xs', 'text-slate-500', 'dark:text-slate-400')}>
                          {charge.daysUntil === 0
                            ? 'Today'
                            : `In ${charge.daysUntil} day${charge.daysUntil === 1 ? '' : 's'}`}
                        </div>
                      </div>
                      <div
                        className={cn(
                          'rounded-full',
                          'px-2',
                          'py-1',
                          'text-[10px]',
                          'font-medium',
                          charge.confidence === 'high'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                        )}
                      >
                        {charge.confidence}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <MonthYearSelector value={period} onChange={onPeriodChange} />
        </div>
      </PageLayout>
    </div>
  );
};

export default DashboardPage;
