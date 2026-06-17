import { Landmark, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { ACCOUNT_GROUP_LABELS } from '../domain/accountCategories';
import { BalancesBankTooltip } from '../features/analytics/components/BalancesBankTooltip';
import { BalancesChartXAxisTick } from '../features/analytics/components/BalancesChartXAxisTick';
import { BalancesChartYAxisTick } from '../features/analytics/components/BalancesChartYAxisTick';
import { BalancesInsightsPanel } from '../features/analytics/components/BalancesInsightsPanel';
import { chartTooltipRechartsProps } from '../features/analytics/components/ChartGlassTooltip';
import { useChartContainerSize } from '../features/analytics/hooks/useChartContainerSize';
import { useDebouncedChartRecalc } from '../features/analytics/hooks/useDebouncedChartRecalc';
import { useYtdIncomeExpenses } from '../features/analytics/hooks/useYtdIncomeExpenses';
import { shouldStackBalanceInstitutions } from '../features/analytics/utils/balanceInstitutionChartLayout';
import {
  asymmetricZeroAxisTicks,
  balancesYTickCount,
  formatBalancesAxisValue,
  safeBalanceAmount,
  sortBanksAlphabetically,
} from '../features/analytics/utils/balancesChartAxis';
import {
  institutionLabelAxisHeight,
  institutionLabelLineCount,
  maxCharsPerInstitutionSlotForWidth,
} from '../features/analytics/utils/wrapInstitutionLabel';
import { useBalancesOverview } from '../hooks/useBalancesOverview';
import { Alert, Button, cn, EmptyState } from '../ui/primitives';
import {
  control,
  surface as semanticSurfaces,
  border as uiBorderRecipes,
  radius as uiRadiusRecipes,
  text as uiTextRecipes,
} from '../ui/recipes';

const dashboardSummaryShellLoading = [
  `h-16 ${uiRadiusRecipes.standard} border`,
  ...uiBorderRecipes.subtle,
  ...semanticSurfaces.mutedChip,
] as const;

type BalancesOverviewVariant = 'full' | 'summary' | 'chart';

type BalancesOverviewProps = {
  variant?: BalancesOverviewVariant;
};

type BankBarDatum = {
  bank: string;
  cash: number | null;
  investments: number | null;
  credit: number | null;
  loan: number | null;
};

export function BalancesOverview({ variant = 'full' }: BalancesOverviewProps = {}) {
  const { loading, refreshing, error, data, refresh } = useBalancesOverview();
  const { incomeYtd, expensesYtd, loading: ytdLoading } = useYtdIncomeExpenses();
  const { colors } = useTheme();
  const showSummary = variant !== 'chart';
  const showChart = variant !== 'summary';

  const banks = data?.banks || [];
  const debouncedBanks = useDebouncedChartRecalc(banks);
  const overall = data?.overall;

  const { ref: chartSizeRef, width: chartContainerWidth } = useChartContainerSize();
  const chartInnerHeight = Math.max(120, Math.round(chartContainerWidth * 0.13));
  const yTickCount = balancesYTickCount(chartInnerHeight);

  const chartLayout = useMemo(() => {
    const bankPositiveTotals = debouncedBanks.map(
      (b) => safeBalanceAmount(b.cash) + safeBalanceAmount(b.investments)
    );
    const bankNegativeTotals = debouncedBanks.map((b) =>
      Math.abs(safeBalanceAmount(b.credit) + safeBalanceAmount(b.loan))
    );
    const maxPositive = bankPositiveTotals.length ? Math.max(0, ...bankPositiveTotals) : 0;
    const maxNegativeAbs = bankNegativeTotals.length ? Math.max(0, ...bankNegativeTotals) : 0;
    const { ticks: yAxisTicks, domain: yAxisDomain } = asymmetricZeroAxisTicks(
      maxPositive,
      maxNegativeAbs,
      yTickCount
    );
    const axisMax = Math.max(Math.abs(yAxisDomain[0]), yAxisDomain[1]);
    const maxLabelLen = Math.max(
      formatBalancesAxisValue(axisMax).length,
      formatBalancesAxisValue(-axisMax).length
    );
    let yTickFontSize = 12;
    if (maxLabelLen >= 14) yTickFontSize = 11;
    if (maxLabelLen >= 16) yTickFontSize = 10;
    if (maxLabelLen >= 18) yTickFontSize = 9;
    const approxCharWidth = yTickFontSize * 0.62;
    const yAxisWidth = Math.min(120, Math.ceil(maxLabelLen * approxCharWidth) + 12);
    const maxCharsPerLine = maxCharsPerInstitutionSlotForWidth(
      debouncedBanks.length,
      chartContainerWidth,
      yAxisWidth
    );
    const maxLabelLines =
      debouncedBanks.length > 0
        ? Math.max(
            1,
            ...debouncedBanks.map((bank) =>
              institutionLabelLineCount(bank.bankName, maxCharsPerLine)
            )
          )
        : 1;
    const xAxisHeight = institutionLabelAxisHeight(maxLabelLines);
    return { yTickFontSize, yAxisWidth, yAxisTicks, maxCharsPerLine, xAxisHeight, yAxisDomain };
  }, [chartContainerWidth, debouncedBanks, yTickCount]);

  const chartData = useMemo<BankBarDatum[]>(
    () =>
      sortBanksAlphabetically(debouncedBanks).map((b) => ({
        bank: b.bankName,
        cash: safeBalanceAmount(b.cash),
        investments: safeBalanceAmount(b.investments),
        credit: safeBalanceAmount(b.credit),
        loan: safeBalanceAmount(b.loan),
      })),
    [debouncedBanks]
  );
  const useStackedBars = shouldStackBalanceInstitutions(chartData.length);
  const balanceStackId = useStackedBars ? 'balance' : undefined;

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const [isTouchPrimary, setIsTouchPrimary] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches
  );
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const totalChartHeight = chartInnerHeight + chartLayout.xAxisHeight;
  const hoverClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
    const syncTouchPrimary = () => setIsTouchPrimary(mediaQuery.matches);
    syncTouchPrimary();
    mediaQuery.addEventListener('change', syncTouchPrimary);
    return () => mediaQuery.removeEventListener('change', syncTouchPrimary);
  }, []);

  useEffect(() => {
    if (!isTouchPrimary || selectedIndex === null) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const chartEl = chartContainerRef.current;
      if (chartEl && event.target instanceof Node && chartEl.contains(event.target)) {
        return;
      }
      setSelectedIndex(null);
      setTooltipAnchor(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isTouchPrimary, selectedIndex]);

  const highlightIndex = isTouchPrimary ? selectedIndex : (hoverIndex ?? selectedIndex);

  const touchTooltipDatum =
    isTouchPrimary && selectedIndex != null ? chartData[selectedIndex] : undefined;

  const showTouchTooltip = Boolean(isTouchPrimary && touchTooltipDatum && tooltipAnchor);

  const cancelHoverClear = useCallback(() => {
    if (hoverClearTimeoutRef.current) {
      clearTimeout(hoverClearTimeoutRef.current);
      hoverClearTimeoutRef.current = null;
    }
  }, []);

  const institutionCellProps = (index: number) => {
    const isActive = highlightIndex === index;
    return {
      fillOpacity: highlightIndex === null || isActive ? 1 : 0.35,
      style: { cursor: 'pointer' } as const,
    };
  };

  const handleBarMouseEnter = useCallback(
    (_: unknown, index: number) => {
      if (isTouchPrimary) {
        return;
      }
      cancelHoverClear();
      setHoverIndex(index);
    },
    [cancelHoverClear, isTouchPrimary]
  );

  const handleBarMouseLeave = useCallback(() => {
    if (isTouchPrimary) {
      return;
    }
    cancelHoverClear();
    hoverClearTimeoutRef.current = setTimeout(() => {
      setHoverIndex(null);
      hoverClearTimeoutRef.current = null;
    }, 50);
  }, [cancelHoverClear, isTouchPrimary]);

  const handleChartMouseLeave = useCallback(() => {
    cancelHoverClear();
    setHoverIndex(null);
  }, [cancelHoverClear]);

  const handleChartClick = useCallback(
    (state: {
      activeTooltipIndex?: string | number;
      activeCoordinate?: { x?: number; y?: number };
    }) => {
      const rawIndex = state.activeTooltipIndex;
      const index = typeof rawIndex === 'number' ? rawIndex : Number(rawIndex);
      if (!Number.isFinite(index) || !chartData[index]) {
        return;
      }

      setHoverIndex(null);
      setSelectedIndex((prev) => {
        const next = prev === index ? null : index;
        if (next === null) {
          setTooltipAnchor(null);
        } else if (state.activeCoordinate?.x != null && state.activeCoordinate?.y != null) {
          setTooltipAnchor({
            x: state.activeCoordinate.x,
            y: state.activeCoordinate.y,
          });
        }
        return next;
      });
    },
    [chartData]
  );

  return (
    <div className="space-y-4">
      {!loading && refreshing ? (
        <div className={cn('flex', 'items-center', 'justify-end')}>
          <RefreshCcw
            aria-label="Refreshing balances"
            className={cn(control.glyph.md, uiTextRecipes.subtle, 'animate-spin')}
          />
        </div>
      ) : null}

      {loading && (
        <div
          data-testid="balances-loading"
          className={cn(dashboardSummaryShellLoading, 'h-16', 'w-full')}
        />
      )}

      {!loading && error && (
        <Alert
          data-testid="balances-error"
          variant="error"
          title="Balances unavailable"
          className={cn('flex', 'items-center', 'justify-between', 'gap-3')}
        >
          <span>Failed to load balances. {error}</span>
          <Button variant="danger" size="sm" onClick={refresh}>
            Retry
          </Button>
        </Alert>
      )}

      <div className={cn('space-y-5')}>
        {showSummary && !loading && overall ? (
          <BalancesInsightsPanel
            overall={overall}
            resetKey={data?.asOf ?? 'default'}
            incomeYtd={ytdLoading ? undefined : incomeYtd}
            expensesYtd={ytdLoading ? undefined : expensesYtd}
          />
        ) : null}

        {showChart ? (
          <div
            ref={chartContainerRef}
            className={cn(
              'relative',
              'mt-2',
              'w-full',
              'min-w-0',
              'overflow-visible',
              'outline-none',
              '[&_.recharts-wrapper]:outline-none',
              '[&_.recharts-surface]:outline-none',
              '[&_.recharts-wrapper:focus]:outline-none',
              '[&_.recharts-wrapper:focus-visible]:outline-none',
              '[&_.recharts-surface:focus]:outline-none',
              '[&_.recharts-surface:focus-visible]:outline-none',
              '[&_.recharts-tooltip-cursor]:hidden'
            )}
          >
            <div
              ref={chartSizeRef}
              className={cn('w-full', 'min-w-0')}
              style={{ height: 1 }}
              aria-hidden
            />
            {showTouchTooltip && touchTooltipDatum && tooltipAnchor ? (
              <div
                className={cn('pointer-events-none', 'absolute', 'z-50', 'max-w-[min(100%,20rem)]')}
                style={{
                  left: tooltipAnchor.x,
                  top: 0,
                  transform: 'translate(-50%, calc(-100% - 0.5rem))',
                }}
                data-testid="balances-chart-touch-tooltip"
              >
                <BalancesBankTooltip
                  active
                  payload={
                    [
                      { payload: touchTooltipDatum, graphicalItemId: 'balances-touch' },
                    ] as Parameters<typeof BalancesBankTooltip>[0]['payload']
                  }
                  label={touchTooltipDatum.bank}
                  coordinate={tooltipAnchor}
                  accessibilityLayer={false}
                  activeIndex={selectedIndex != null ? String(selectedIndex) : undefined}
                />
              </div>
            ) : null}
            {chartContainerWidth > 0 && chartData.length === 0 && (
              <div
                className={cn('w-full', 'min-w-0', 'flex', 'items-center', 'justify-center')}
                style={{ height: totalChartHeight }}
                data-testid="balances-chart-empty"
              >
                <EmptyState
                  icon={Landmark}
                  title="No balances to survey"
                  description="Link your ally accounts to see your full financial picture."
                />
              </div>
            )}
            {chartContainerWidth > 0 && chartData.length > 0 && (
              <div
                className={cn('w-full', 'min-w-0')}
                style={{ height: totalChartHeight }}
                data-testid="balances-chart-plot"
                data-chart-layout={useStackedBars ? 'stacked' : 'grouped'}
              >
                <BarChart
                  width={chartContainerWidth}
                  height={totalChartHeight}
                  data={chartData}
                  stackOffset={useStackedBars ? 'sign' : undefined}
                  accessibilityLayer={false}
                  margin={{
                    top: 8,
                    right: 16,
                    left: 0,
                    bottom: chartLayout.xAxisHeight,
                  }}
                  onMouseDown={(_state, event) => event.preventDefault()}
                  onMouseLeave={handleChartMouseLeave}
                  onClick={handleChartClick}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.chart.grid} />
                  <XAxis
                    dataKey="bank"
                    interval={0}
                    tickLine={false}
                    tickMargin={0}
                    axisLine={{ stroke: colors.chart.grid }}
                    height={chartLayout.xAxisHeight}
                    tick={(props) => (
                      <BalancesChartXAxisTick
                        {...props}
                        fill={colors.chart.axis}
                        maxCharsPerLine={chartLayout.maxCharsPerLine}
                      />
                    )}
                  />
                  <YAxis
                    type="number"
                    width={chartLayout.yAxisWidth}
                    domain={chartLayout.yAxisDomain}
                    ticks={chartLayout.yAxisTicks}
                    allowDecimals={false}
                    minTickGap={0}
                    tickLine={false}
                    axisLine={false}
                    tick={(props) => (
                      <BalancesChartYAxisTick
                        {...props}
                        fill={colors.chart.axis}
                        fontSize={chartLayout.yTickFontSize}
                        formatValue={formatBalancesAxisValue}
                      />
                    )}
                  />
                  <ReferenceLine y={0} stroke={colors.chart.grid} strokeWidth={1} />
                  <Tooltip
                    cursor={false}
                    active={isTouchPrimary ? false : undefined}
                    content={(tooltipProps) => <BalancesBankTooltip {...tooltipProps} />}
                    {...chartTooltipRechartsProps}
                  />
                  <Bar
                    dataKey="cash"
                    name={ACCOUNT_GROUP_LABELS.cash}
                    stackId={balanceStackId}
                    fill={colors.semantic.cash}
                    legendType="circle"
                    onMouseEnter={handleBarMouseEnter}
                    onMouseLeave={handleBarMouseLeave}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cash-${entry.bank}`} {...institutionCellProps(index)} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="investments"
                    name={ACCOUNT_GROUP_LABELS.investments}
                    stackId={balanceStackId}
                    fill={colors.semantic.investments}
                    legendType="circle"
                    onMouseEnter={handleBarMouseEnter}
                    onMouseLeave={handleBarMouseLeave}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`investments-${entry.bank}`} {...institutionCellProps(index)} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="credit"
                    name={ACCOUNT_GROUP_LABELS.credit}
                    stackId={balanceStackId}
                    fill={colors.semantic.credit}
                    legendType="circle"
                    onMouseEnter={handleBarMouseEnter}
                    onMouseLeave={handleBarMouseLeave}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`credit-${entry.bank}`} {...institutionCellProps(index)} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="loan"
                    name={ACCOUNT_GROUP_LABELS.loans}
                    stackId={balanceStackId}
                    fill={colors.semantic.loan}
                    legendType="circle"
                    onMouseEnter={handleBarMouseEnter}
                    onMouseLeave={handleBarMouseLeave}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`loan-${entry.bank}`} {...institutionCellProps(index)} />
                    ))}
                  </Bar>
                </BarChart>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BalancesOverviewSummary() {
  const { loading, error, data, refresh } = useBalancesOverview();
  const { incomeYtd, expensesYtd, loading: ytdLoading } = useYtdIncomeExpenses();
  const overall = data?.overall;

  if (loading) {
    return (
      <div
        data-testid="balances-loading"
        className={cn(dashboardSummaryShellLoading, 'h-16', 'w-full')}
      />
    );
  }

  if (error) {
    return (
      <Alert
        data-testid="balances-error"
        variant="error"
        title="Balances unavailable"
        className={cn('flex', 'items-center', 'justify-between', 'gap-3')}
      >
        <span>Failed to load balances. {error}</span>
        <Button variant="danger" size="sm" onClick={refresh}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!overall) {
    return null;
  }

  return (
    <BalancesInsightsPanel
      overall={overall}
      resetKey={data?.asOf ?? 'default'}
      incomeYtd={ytdLoading ? undefined : incomeYtd}
      expensesYtd={ytdLoading ? undefined : expensesYtd}
    />
  );
}

export function BalancesOverviewChart() {
  return <BalancesOverview variant="chart" />;
}

export default BalancesOverview;
