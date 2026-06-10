import { Landmark, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { ACCOUNT_GROUP_LABELS } from '../domain/accountCategories';
import { BalancesChartXAxisTick } from '../features/analytics/components/BalancesChartXAxisTick';
import { BalancesChartYAxisTick } from '../features/analytics/components/BalancesChartYAxisTick';
import { BalancesInsightsPanel } from '../features/analytics/components/BalancesInsightsPanel';
import {
  ChartTooltipFadeHost,
  ChartTooltipShell,
} from '../features/analytics/components/ChartGlassTooltip';
import { useChartContainerSize } from '../features/analytics/hooks/useChartContainerSize';
import { useDebouncedChartRecalc } from '../features/analytics/hooks/useDebouncedChartRecalc';
import {
  balancesYTickCount,
  formatBalancesAxisValue,
  safeBalanceAmount,
  sortBanksAlphabetically,
  symmetricZeroAxisTicks,
} from '../features/analytics/utils/balancesChartAxis';
import {
  INSTITUTION_LABEL_AXIS_GAP,
  INSTITUTION_LABEL_LINE_HEIGHT,
  institutionLabelLineCount,
  maxCharsPerInstitutionSlot,
} from '../features/analytics/utils/wrapInstitutionLabel';
import { useBalancesOverview } from '../hooks/useBalancesOverview';
import { Alert, Button, cn, EmptyState } from '../ui/primitives';
import {
  control,
  surface as semanticSurfaces,
  border as uiBorderRecipes,
  radius as uiRadiusRecipes,
  status as uiStatusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '../ui/recipes';
import { fmtUSD } from './Amount';

const dashboardSummaryShellLoading = [
  `h-16 ${uiRadiusRecipes.standard} border`,
  ...uiBorderRecipes.subtle,
  ...semanticSurfaces.mutedChip,
] as const;

type BankBarDatum = {
  bank: string;
  cash: number | null;
  investments: number | null;
  credit: number | null;
  loan: number | null;
};

export function BalancesOverview() {
  const { loading, refreshing, error, data, refresh } = useBalancesOverview();
  const { colors } = useTheme();

  const banks = data?.banks || [];
  const debouncedBanks = useDebouncedChartRecalc(banks);
  const overall = data?.overall;

  const { ref: chartSizeRef, width: chartContainerWidth } = useChartContainerSize();
  const chartInnerHeight = Math.max(220, Math.round(chartContainerWidth * 0.35));
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
    const maxExtent = Math.max(maxPositive, maxNegativeAbs);
    const { ticks: yAxisTicks, domain: yAxisDomain } = symmetricZeroAxisTicks(
      maxExtent,
      yTickCount
    );
    const axisMax = yAxisDomain[1];
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
    const maxCharsPerLine = maxCharsPerInstitutionSlot(debouncedBanks.length);
    const maxLabelLines =
      debouncedBanks.length > 0
        ? Math.max(
            1,
            ...debouncedBanks.map((bank) =>
              institutionLabelLineCount(bank.bankName, maxCharsPerLine)
            )
          )
        : 1;
    const xAxisHeight =
      maxLabelLines * INSTITUTION_LABEL_LINE_HEIGHT + INSTITUTION_LABEL_AXIS_GAP + 8;
    return { yTickFontSize, yAxisWidth, yAxisTicks, maxCharsPerLine, xAxisHeight, yAxisDomain };
  }, [debouncedBanks, yTickCount]);

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

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
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
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isTouchPrimary, selectedIndex]);

  const highlightIndex = isTouchPrimary ? selectedIndex : (hoverIndex ?? selectedIndex);
  const menuIndex = isTouchPrimary ? selectedIndex : hoverIndex;

  const hoverInfo = useMemo(() => {
    if (menuIndex == null || !chartData[menuIndex]) {
      return null;
    }
    const payload = chartData[menuIndex];
    return {
      bank: payload.bank,
      cash: payload.cash,
      investments: payload.investments,
      credit: payload.credit,
      loan: payload.loan,
    };
  }, [chartData, menuIndex]);

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

  const handleBarClick = useCallback(
    (_: unknown, index: number) => {
      if (!chartData[index]) {
        return;
      }
      setHoverIndex(null);
      setSelectedIndex((prev) => (prev === index ? null : index));
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
        {!loading && overall ? (
          <BalancesInsightsPanel overall={overall} resetKey={data?.asOf ?? 'default'} />
        ) : null}

        <div
          ref={chartContainerRef}
          className={cn(
            'relative',
            'mt-4',
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
          <ChartTooltipFadeHost
            active={hoverInfo}
            presence={{ showDelayMs: 60, hideDelayMs: 80, fadeDurationMs: 200 }}
            wrapperClassName={cn(
              'pointer-events-none',
              'absolute',
              'bottom-full',
              'left-0',
              'right-0',
              'z-10',
              'mb-4',
              '-translate-y-1',
              'flex',
              'justify-center',
              'px-2'
            )}
          >
            {(info) => (
              <ChartTooltipShell
                className={cn(
                  'flex flex-col gap-2',
                  uiTypographyRecipes.caption,
                  uiTextRecipes.body
                )}
              >
                <p className={cn(uiTypographyRecipes.captionStrong, uiTextRecipes.primary)}>
                  {info.bank}
                </p>
                <div className={cn('grid grid-cols-2 gap-x-4 gap-y-2')}>
                  <span className={cn('flex items-center gap-1', uiStatusRecipes.success.text)}>
                    <span className={cn('h-2 w-2 shrink-0 rounded-full bg-emerald-500')} />
                    {ACCOUNT_GROUP_LABELS.cash}: {fmtUSD(info.cash ?? 0)}
                  </span>
                  <span className={cn('flex items-center gap-1', uiStatusRecipes.info.text)}>
                    <span className={cn('h-2 w-2 shrink-0 rounded-full bg-cyan-500')} />
                    {ACCOUNT_GROUP_LABELS.investments}: {fmtUSD(info.investments ?? 0)}
                  </span>
                  <span className={cn('flex items-center gap-1', uiStatusRecipes.danger.text)}>
                    <span className={cn('h-2 w-2 shrink-0 rounded-full bg-rose-500')} />
                    {ACCOUNT_GROUP_LABELS.credit}: {fmtUSD(info.credit ?? 0)}
                  </span>
                  <span className={cn('flex items-center gap-1', uiStatusRecipes.warning.text)}>
                    <span className={cn('h-2 w-2 shrink-0 rounded-full bg-amber-500')} />
                    {ACCOUNT_GROUP_LABELS.loans}: {fmtUSD(info.loan ?? 0)}
                  </span>
                </div>
              </ChartTooltipShell>
            )}
          </ChartTooltipFadeHost>
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
            >
              <BarChart
                width={chartContainerWidth}
                height={totalChartHeight}
                data={chartData}
                stackOffset="sign"
                accessibilityLayer={false}
                margin={{
                  top: 8,
                  right: 16,
                  left: 0,
                  bottom: chartLayout.xAxisHeight,
                }}
                onMouseDown={(_state, event) => event.preventDefault()}
                onMouseLeave={handleChartMouseLeave}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.chart.grid} />
                <XAxis
                  dataKey="bank"
                  interval={0}
                  tickLine={false}
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
                <Bar
                  dataKey="cash"
                  name={ACCOUNT_GROUP_LABELS.cash}
                  stackId="balance"
                  fill={colors.semantic.cash}
                  legendType="circle"
                  onMouseEnter={handleBarMouseEnter}
                  onMouseLeave={handleBarMouseLeave}
                  onClick={handleBarClick}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cash-${entry.bank}`} {...institutionCellProps(index)} />
                  ))}
                </Bar>
                <Bar
                  dataKey="investments"
                  name={ACCOUNT_GROUP_LABELS.investments}
                  stackId="balance"
                  fill={colors.semantic.investments}
                  legendType="circle"
                  onMouseEnter={handleBarMouseEnter}
                  onMouseLeave={handleBarMouseLeave}
                  onClick={handleBarClick}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`investments-${entry.bank}`} {...institutionCellProps(index)} />
                  ))}
                </Bar>
                <Bar
                  dataKey="credit"
                  name={ACCOUNT_GROUP_LABELS.credit}
                  stackId="balance"
                  fill={colors.semantic.credit}
                  legendType="circle"
                  onMouseEnter={handleBarMouseEnter}
                  onMouseLeave={handleBarMouseLeave}
                  onClick={handleBarClick}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`credit-${entry.bank}`} {...institutionCellProps(index)} />
                  ))}
                </Bar>
                <Bar
                  dataKey="loan"
                  name={ACCOUNT_GROUP_LABELS.loans}
                  stackId="balance"
                  fill={colors.semantic.loan}
                  legendType="circle"
                  onMouseEnter={handleBarMouseEnter}
                  onMouseLeave={handleBarMouseLeave}
                  onClick={handleBarClick}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`loan-${entry.bank}`} {...institutionCellProps(index)} />
                  ))}
                </Bar>
              </BarChart>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BalancesOverview;
