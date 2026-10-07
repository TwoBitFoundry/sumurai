'use client';

import { GitFork, Layers, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import MonthYearSelector from '../components/MonthYearSelector';
import Card from '../components/ui/Card';
import { SankeyCalculator } from '../domain/SankeyCalculator';
import { SankeyChart } from '../features/analytics/components/SankeyChart';
import { useAccountFilter } from '../hooks/useAccountFilter';
import { useCurrency } from '../hooks/useCurrency';
import { PageLayout } from '../layouts/PageLayout';
import { AnalyticsService } from '../services/AnalyticsService';
import { TransactionService } from '../services/TransactionService';
import type { AnalyticsCategoryTrendResponse, Transaction } from '../types/api';
import { Button, cn } from '../ui/primitives';
import { formatCategoryName, resolveMajorCategory } from '../utils/categories';
import {
  computeMonthRange,
  getCurrentMonthSelection,
  type MonthYearSelection,
} from '../utils/dateRanges';

type ViewMode = 'sankey' | 'line';

const LINE_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];
const MAX_SELECTED_CATEGORIES = LINE_COLORS.length;

const getMonthKeys = (
  start?: string,
  end?: string,
  points: AnalyticsCategoryTrendResponse[] = []
) => {
  const pointMonths = points.map((point) => point.month).sort();
  const first = start?.slice(0, 7) ?? pointMonths[0];
  const last = end?.slice(0, 7) ?? pointMonths.at(-1);
  if (!first || !last) return [];

  const [startYear, startMonth] = first.split('-').map(Number);
  const [endYear, endMonth] = last.split('-').map(Number);
  const cursor = new Date(startYear, startMonth - 1, 1);
  const finish = new Date(endYear, endMonth - 1, 1);
  const months: string[] = [];
  while (cursor <= finish) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
};

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(
    new Date(year, monthNumber - 1, 1)
  );
};

interface TrendsPageProps {
  period?: MonthYearSelection;
  onPeriodChange?: (period: MonthYearSelection) => void;
}

export default function TrendsPage({
  period: controlledPeriod,
  onPeriodChange: controlledSetPeriod,
}: TrendsPageProps = {}) {
  const [uncontrolledPeriod, setUncontrolledPeriod] = useState<MonthYearSelection>(() =>
    getCurrentMonthSelection()
  );
  const activePeriod = controlledPeriod ?? uncontrolledPeriod;
  const handlePeriodChange = controlledSetPeriod ?? setUncontrolledPeriod;

  const [viewMode, setViewMode] = useState<ViewMode>('sankey');
  const [includeSubcategories, setIncludeSubcategories] = useState(false);

  // Transactions state for Sankey
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sankeyLoading, setSankeyLoading] = useState(true);

  // Line trends points state
  const [points, setPoints] = useState<AnalyticsCategoryTrendResponse[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const { format, formatConverted, convert } = useCurrency();
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const isFullYear = activePeriod.month === null;
  const range = useMemo(() => computeMonthRange(activePeriod), [activePeriod]);
  const periodLabel = useMemo(() => {
    if (activePeriod.month === null) {
      return `Full Year ${activePeriod.year}`;
    }
    const date = new Date(activePeriod.year, activePeriod.month, 1);
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
  }, [activePeriod]);

  // Load Transactions for Sankey
  useEffect(() => {
    if (accountsLoading) return;
    if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
      setTransactions([]);
      setSankeyLoading(false);
      return;
    }

    let cancelled = false;
    setSankeyLoading(true);
    setError(null);

    const accountIds =
      !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;

    TransactionService.getTransactions({
      startDate: range.start,
      endDate: range.end,
      accountIds,
    })
      .then((txs) => {
        if (!cancelled) {
          setTransactions(Array.isArray(txs) ? txs : []);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setTransactions([]);
          setError(reason instanceof Error ? reason.message : 'Failed to load transactions');
        }
      })
      .finally(() => {
        if (!cancelled) setSankeyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    accountsLoading,
    allAccountIds.length,
    isAllAccountsSelected,
    range.end,
    range.start,
    selectedAccountIds,
  ]);

  // Compute Sankey calculation
  const sankeyResult = useMemo(() => {
    return SankeyCalculator.computeSankeyData(transactions, {
      includeSubcategories,
    });
  }, [transactions, includeSubcategories]);

  // Load Line chart trends only when in line mode
  useEffect(() => {
    if (viewMode !== 'line') return;
    if (accountsLoading) return;
    if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
      setPoints([]);
      setLineLoading(false);
      return;
    }

    let cancelled = false;
    setLineLoading(true);

    const accountIds =
      !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;

    AnalyticsService.getCategoryTrends(range.start, range.end, accountIds)
      .then((result) => {
        if (!cancelled) setPoints(Array.isArray(result) ? result : []);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setPoints([]);
          setError(reason instanceof Error ? reason.message : 'Failed to load spending trends');
        }
      })
      .finally(() => {
        if (!cancelled) setLineLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    accountsLoading,
    allAccountIds.length,
    isAllAccountsSelected,
    range.end,
    range.start,
    selectedAccountIds,
    viewMode,
  ]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of points) {
      const cat = resolveMajorCategory(point.category);
      totals.set(cat, (totals.get(cat) ?? 0) + Number(point.amount));
    }
    return Array.from(totals, ([category, total]) => ({ category, total })).sort(
      (a, b) => b.total - a.total
    );
  }, [points]);

  useEffect(() => {
    if (selectionTouched || categoryTotals.length === 0) return;
    setSelectedCategories(
      categoryTotals.slice(0, MAX_SELECTED_CATEGORIES).map(({ category }) => category)
    );
  }, [categoryTotals, selectionTouched]);

  const monthKeys = useMemo(
    () => getMonthKeys(range.start, range.end, points),
    [points, range.end, range.start]
  );

  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>(
      monthKeys.map((month) => [month, { month, label: formatMonth(month) }])
    );
    for (const category of selectedCategories) {
      for (const row of rows.values()) row[category] = 0;
    }
    for (const point of points) {
      const cat = resolveMajorCategory(point.category);
      if (!selectedCategories.includes(cat)) continue;
      const row = rows.get(point.month);
      if (row) {
        const cur = Number(row[cat]) || 0;
        row[cat] = cur + convert(Number(point.amount));
      }
    }
    return Array.from(rows.values());
  }, [convert, monthKeys, points, selectedCategories]);

  const selectedTotal = useMemo(
    () =>
      points
        .filter((point) => selectedCategories.includes(resolveMajorCategory(point.category)))
        .reduce((sum, point) => sum + Number(point.amount), 0),
    [points, selectedCategories]
  );
  const monthlySelectedTotals = chartData.map((row) =>
    selectedCategories.reduce((sum, category) => sum + Number(row[category] ?? 0), 0)
  );
  const activeMonthCount = monthlySelectedTotals.filter((total) => total > 0).length;
  const latest = monthlySelectedTotals.at(-1) ?? 0;
  const previous = monthlySelectedTotals.at(-2) ?? 0;
  const monthlyChange = previous > 0 ? ((latest - previous) / previous) * 100 : null;
  const peakIndex = monthlySelectedTotals.reduce(
    (best, value, index, values) => (value > values[best] ? index : best),
    0
  );
  const peakLabel = selectedTotal > 0 ? (chartData[peakIndex]?.label ?? 'No data') : 'No data';

  const toggleCategory = (category: string) => {
    setSelectionTouched(true);
    setSelectedCategories((current) => {
      if (current.includes(category)) return current.filter((item) => item !== category);
      if (current.length >= MAX_SELECTED_CATEGORIES) return current;
      return [...current, category];
    });
  };

  const isSankey = viewMode === 'sankey';
  const stats = sankeyResult.stats;

  return (
    <PageLayout
      badge="Trends"
      title="Financial Flow & Trends"
      subtitle={
        isSankey
          ? `Cash flow diagram for ${periodLabel} (${range.start} to ${range.end}).`
          : `Compare how your spending categories change month by month in ${isFullYear ? activePeriod.year : periodLabel}.`
      }
      error={error}
      className="pb-24"
      actions={
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-full bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('sankey')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                isSankey
                  ? 'bg-white shadow-sm text-sky-600 dark:bg-slate-700 dark:text-sky-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              <GitFork className="h-3.5 w-3.5" />
              <span>Flow (Sankey)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('line')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                !isSankey
                  ? 'bg-white shadow-sm text-sky-600 dark:bg-slate-700 dark:text-sky-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Trends (Line)</span>
            </button>
          </div>
        </div>
      }
    >
      {/* Top KPI Cards */}
      <div className={cn('grid', 'gap-4', 'sm:grid-cols-2', 'xl:grid-cols-4')}>
        {isSankey ? (
          <>
            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Inflow
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {format(stats.totalInflow)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {stats.inflowCount} income deposits · {periodLabel}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Outflow
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {format(stats.totalOutflow)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {stats.outflowCount} spending transactions · {periodLabel}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Net Savings
              </div>
              <div
                className={cn(
                  'mt-2 text-2xl font-bold',
                  stats.netSavings >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                )}
              >
                {stats.netSavings >= 0 ? '+' : ''}
                {format(stats.netSavings)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {stats.totalInflow > 0
                  ? `${stats.savingsRate}% savings rate`
                  : stats.totalOutflow > 0
                    ? 'Net Deficit'
                    : 'No activity'}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Top Expense
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white truncate">
                {stats.topExpenseCategory
                  ? formatCategoryName(stats.topExpenseCategory.name)
                  : 'None'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {stats.topExpenseCategory
                  ? `${format(stats.topExpenseCategory.amount)} (${stats.topExpenseCategory.percentage}%)`
                  : 'No expenses'}
              </div>
            </Card>
          </>
        ) : (
          [
            ['Selected spend', format(selectedTotal)],
            ['Monthly average', format(activeMonthCount ? selectedTotal / activeMonthCount : 0)],
            [
              'Latest vs previous',
              monthlyChange === null
                ? 'No comparison'
                : `${monthlyChange >= 0 ? '+' : ''}${monthlyChange.toFixed(1)}%`,
            ],
            ['Highest month', peakLabel],
          ].map(([label, value]) => (
            <Card key={label} className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
            </Card>
          ))
        )}
      </div>

      {/* Main Chart Card */}
      <Card>
        {isSankey ? (
          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <GitFork className="h-5 w-5 text-sky-500" />
                  <span>Cash Flow Diagram</span>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    {periodLabel}
                  </span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {sankeyResult.hasIncome
                    ? 'Income sources flow into Total Cash Flow, then split into expense categories and savings.'
                    : 'Spending breakdown across major categories and subcategories.'}
                </p>
              </div>

              {/* Subcategories Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none px-3 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/80 hover:bg-slate-100 transition-colors">
                <Layers className="h-3.5 w-3.5 text-sky-500" />
                <input
                  type="checkbox"
                  checked={includeSubcategories}
                  onChange={(e) => setIncludeSubcategories(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                />
                <span>Include subcategories</span>
              </label>
            </div>

            {sankeyLoading ? (
              <div className="flex h-[440px] items-center justify-center text-sm text-slate-500">
                Loading cash flow diagram...
              </div>
            ) : !sankeyResult.hasData ? (
              <div className="flex h-[360px] flex-col items-center justify-center text-sm text-slate-500">
                <p>No transaction data available for this range.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Try selecting a different time window above.
                </p>
              </div>
            ) : (
              <SankeyChart nodes={sankeyResult.nodes} links={sankeyResult.links} />
            )}
          </div>
        ) : (
          <div>
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Category comparison
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Select up to {MAX_SELECTED_CATEGORIES} categories. The current month may be
                  incomplete.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectionTouched(true);
                    setSelectedCategories(
                      categoryTotals
                        .slice(0, MAX_SELECTED_CATEGORIES)
                        .map(({ category }) => category)
                    );
                  }}
                >
                  Top 6
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectionTouched(true);
                    setSelectedCategories([]);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {categoryTotals.map(({ category }) => {
                const selected = selectedCategories.includes(category);
                const disabled = !selected && selectedCategories.length >= MAX_SELECTED_CATEGORIES;
                return (
                  <button
                    key={category}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      'rounded-full',
                      'border',
                      'px-3',
                      'py-1.5',
                      'text-xs',
                      'font-medium',
                      'transition',
                      selected
                        ? 'border-sky-400 bg-sky-100 text-sky-800 dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-200'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
                      disabled && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    {formatCategoryName(category)}
                  </button>
                );
              })}
            </div>

            <div className="h-[440px]">
              {lineLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading trends...
                </div>
              ) : chartData.length === 0 || selectedCategories.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  {categoryTotals.length === 0
                    ? 'No spending data is available for this range.'
                    : 'Select at least one category to draw the chart.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.22} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) =>
                        new Intl.NumberFormat('en-US', {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        }).format(value)
                      }
                    />
                    <Tooltip formatter={(value) => formatConverted(Number(value))} />
                    <Legend formatter={(value) => formatCategoryName(String(value))} />
                    {selectedCategories.map((category, index) => (
                      <Line
                        key={category}
                        type="monotone"
                        dataKey={category}
                        stroke={LINE_COLORS[index]}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </Card>
      <MonthYearSelector value={activePeriod} onChange={handlePeriodChange} />
    </PageLayout>
  );
}
