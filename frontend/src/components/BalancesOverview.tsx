import { CircleDollarSign, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { ACCOUNT_GROUP_LABELS } from '../domain/accountCategories';
import { BalancesChartXAxisTick } from '../features/analytics/components/BalancesChartXAxisTick';
import {
  ChartTooltipFadeHost,
  ChartTooltipShell,
} from '../features/analytics/components/ChartGlassTooltip';
import { useDebouncedChartRecalc } from '../features/analytics/hooks/useDebouncedChartRecalc';
import {
  INSTITUTION_LABEL_AXIS_GAP,
  INSTITUTION_LABEL_LINE_HEIGHT,
  institutionLabelLineCount,
  maxCharsPerInstitutionSlot,
} from '../features/analytics/utils/wrapInstitutionLabel';
import { useBalancesOverview } from '../hooks/useBalancesOverview';
import { Alert, Button, cn } from '../ui/primitives';
import {
  control,
  surface as semanticSurfaces,
  border as uiBorderRecipes,
  radius as uiRadiusRecipes,
  status as uiStatusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '../ui/recipes';
import { AccountGroupIcon } from './AccountGroupIcon';
import { Amount, fmtUSD } from './Amount';
import HeroStatCard from './widgets/HeroStatCard';

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

function formatAxisValue(n: number) {
  const sign = n < 0 ? '-' : '';
  const absolute = Math.abs(n);
  if (absolute >= 1e12) return `${sign}${Math.round(absolute / 1e12)}T`;
  if (absolute >= 1e9) {
    const rounded = Math.round(absolute / 1e9);
    if (rounded >= 1000) return `${sign}1T`;
    return `${sign}${rounded}B`;
  }
  if (absolute >= 1e6) {
    const rounded = Math.round(absolute / 1e6);
    if (rounded >= 1000) return `${sign}1B`;
    return `${sign}${rounded}M`;
  }
  if (absolute >= 1e4) {
    const rounded = Math.round(absolute / 1e3);
    if (rounded >= 1000) return `${sign}1M`;
    return `${sign}${rounded}k`;
  }
  return `${sign}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(absolute)}`;
}

export function BalancesOverview() {
  const { loading, refreshing, error, data, refresh } = useBalancesOverview();
  const { colors } = useTheme();

  const banks = data?.banks || [];
  const debouncedBanks = useDebouncedChartRecalc(banks);
  const overall = data?.overall;

  const chartLayout = useMemo(() => {
    const maxPositive = debouncedBanks.length
      ? Math.max(0, ...debouncedBanks.map((b) => (b.cash || 0) + (b.investments || 0)))
      : 0;
    const maxNegativeAbs = debouncedBanks.length
      ? Math.max(0, ...debouncedBanks.map((b) => Math.abs((b.credit || 0) + (b.loan || 0))))
      : 0;
    const maxAbs = Math.max(maxPositive, maxNegativeAbs);
    const maxLabelLen = Math.max(formatAxisValue(maxAbs).length, formatAxisValue(-maxAbs).length);
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
    return { yTickFontSize, yAxisWidth, maxCharsPerLine, xAxisHeight };
  }, [debouncedBanks]);

  const chartData = useMemo<BankBarDatum[]>(
    () =>
      debouncedBanks.map((b) => ({
        bank: b.bankName,
        cash: b.cash,
        investments: b.investments,
        credit: b.credit,
        loan: b.loan,
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

  const overviewCards = useMemo(
    () => [
      {
        key: 'net',
        title: 'Net',
        accent: 'violet' as const,
        icon: <CircleDollarSign />,
        value: (
          <span data-testid="overall-net">
            <Amount
              value={overall?.net ?? 0}
              className={cn('text-violet-500', 'dark:text-violet-300')}
            />
          </span>
        ),
      },
      {
        key: 'cash',
        title: ACCOUNT_GROUP_LABELS.cash,
        accent: 'emerald' as const,
        icon: <AccountGroupIcon group="cash" />,
        value: (
          <span data-testid="overall-cash" className={cn(uiStatusRecipes.success.text)}>
            {fmtUSD(overall?.cash ?? 0)}
          </span>
        ),
      },
      {
        key: 'investments',
        title: ACCOUNT_GROUP_LABELS.investments,
        accent: 'sky' as const,
        icon: <AccountGroupIcon group="investments" />,
        value: (
          <span data-testid="overall-investments" className={cn(uiStatusRecipes.info.text)}>
            {fmtUSD(overall?.investments ?? 0)}
          </span>
        ),
      },
      {
        key: 'credit',
        title: ACCOUNT_GROUP_LABELS.credit,
        accent: 'rose' as const,
        icon: <AccountGroupIcon group="credit" />,
        value: (
          <span data-testid="overall-credit" className={cn(uiStatusRecipes.danger.text)}>
            {fmtUSD(overall?.credit ?? 0)}
          </span>
        ),
      },
      {
        key: 'loan',
        title: ACCOUNT_GROUP_LABELS.loans,
        accent: 'amber' as const,
        icon: <AccountGroupIcon group="loans" />,
        value: (
          <span data-testid="overall-loan" className={cn(uiStatusRecipes.warning.text)}>
            {fmtUSD(overall?.loan ?? 0)}
          </span>
        ),
      },
    ],
    [overall?.cash, overall?.credit, overall?.investments, overall?.loan, overall?.net]
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
          className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-5')}
        >
          {[1, 2, 3, 4, 5].map((id) => {
            return (
              <div
                key={id}
                className={cn(dashboardSummaryShellLoading, id === 1 && 'col-span-2 lg:col-span-1')}
              />
            );
          })}
        </div>
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
        <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-5')}>
          {overviewCards.map((card) => (
            <HeroStatCard
              key={card.key}
              title={card.title}
              value={card.value}
              icon={card.icon}
              accent={card.accent}
              className={cn('h-full', card.key === 'net' && 'col-span-2 lg:col-span-1')}
              minHeightClassName="min-h-0"
            />
          ))}
        </div>

        <div
          ref={chartContainerRef}
          className={cn(
            'relative',
            'mt-4',
            'w-full',
            'min-w-0',
            'outline-none',
            '[&_.recharts-wrapper]:outline-none',
            '[&_.recharts-surface]:outline-none',
            '[&_.recharts-wrapper:focus]:outline-none',
            '[&_.recharts-wrapper:focus-visible]:outline-none',
            '[&_.recharts-surface]:outline-none',
            '[&_.recharts-surface:focus]:outline-none',
            '[&_.recharts-surface:focus-visible]:outline-none',
            '[&_.recharts-tooltip-cursor]:hidden'
          )}
          style={{ height: 224 + chartLayout.xAxisHeight }}
        >
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
          <ResponsiveContainer width="100%" height={224 + chartLayout.xAxisHeight}>
            <BarChart
              data={chartData}
              stackOffset="sign"
              accessibilityLayer={false}
              margin={{ top: 8, right: 16, left: 16, bottom: chartLayout.xAxisHeight }}
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
                tickFormatter={(value) => formatAxisValue(value as number)}
                tick={{ fill: colors.chart.axis, fontSize: chartLayout.yTickFontSize }}
                width={chartLayout.yAxisWidth}
                tickMargin={6}
              />
              <Bar
                dataKey="cash"
                name={ACCOUNT_GROUP_LABELS.cash}
                stackId="pos"
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
                stackId="pos"
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
                stackId="neg"
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
                stackId="neg"
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
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default BalancesOverview;
