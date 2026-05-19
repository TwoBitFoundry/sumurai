import { CircleDollarSign, RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { ACCOUNT_GROUP_LABELS } from '../domain/accountCategories';
import { useDebouncedChartRecalc } from '../features/analytics/hooks/useDebouncedChartRecalc';
import { useBalancesOverview } from '../hooks/useBalancesOverview';
import { Alert, Button, cn, GlassCard } from '../ui/primitives';
import {
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

const dashboardHoverInfoLayout = 'flex flex-wrap items-center gap-x-4 gap-y-2';

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
    return { yTickFontSize, yAxisWidth };
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

  const [hoverInfo, setHoverInfo] = useState<{
    bank: string;
    cash?: number | null;
    investments?: number | null;
    credit?: number | null;
    loan?: number | null;
  } | null>(null);

  const handleBarHover = (entry?: { payload?: BankBarDatum | null }) => {
    const payload = entry?.payload;
    if (!payload) {
      setHoverInfo(null);
      return;
    }
    setHoverInfo({
      bank: payload.bank,
      cash: payload.cash,
      investments: payload.investments,
      credit: payload.credit,
      loan: payload.loan,
    });
  };

  const overviewCards = useMemo(
    () => [
      {
        key: 'net',
        title: 'Net',
        accent: 'violet' as const,
        icon: <CircleDollarSign className={cn('h-4', 'w-4')} />,
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
            className={cn('h-4', 'w-4', uiTextRecipes.subtle, 'animate-spin')}
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

        <div className={cn('relative', 'mt-4', 'h-64', 'w-full', 'min-w-0')}>
          {hoverInfo ? (
            <div
              className={cn(
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
              <GlassCard
                variant="accent"
                rounded="lg"
                padding="sm"
                withInnerEffects={false}
                className={cn(
                  dashboardHoverInfoLayout,
                  uiTypographyRecipes.caption,
                  uiTextRecipes.body
                )}
              >
                <span className={cn(uiTypographyRecipes.captionStrong)}>{hoverInfo.bank}</span>
                <span className={cn('flex', 'items-center', 'gap-1', uiStatusRecipes.success.text)}>
                  <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-emerald-500')} />
                  {ACCOUNT_GROUP_LABELS.cash}: {fmtUSD(hoverInfo.cash ?? 0)}
                </span>
                <span className={cn('flex', 'items-center', 'gap-1', uiStatusRecipes.info.text)}>
                  <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-cyan-500')} />
                  {ACCOUNT_GROUP_LABELS.investments}: {fmtUSD(hoverInfo.investments ?? 0)}
                </span>
                <span className={cn('flex', 'items-center', 'gap-1', uiStatusRecipes.danger.text)}>
                  <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-rose-500')} />
                  {ACCOUNT_GROUP_LABELS.credit}: {fmtUSD(hoverInfo.credit ?? 0)}
                </span>
                <span className={cn('flex', 'items-center', 'gap-1', uiStatusRecipes.warning.text)}>
                  <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-amber-500')} />
                  {ACCOUNT_GROUP_LABELS.loans}: {fmtUSD(hoverInfo.loan ?? 0)}
                </span>
              </GlassCard>
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height={256}>
            <BarChart
              data={chartData}
              stackOffset="sign"
              margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
              onMouseLeave={() => setHoverInfo(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chart.grid} />
              <XAxis dataKey="bank" tick={{ fill: colors.chart.axis, fontSize: 12 }} />
              <YAxis
                tickFormatter={(value) => formatAxisValue(value as number)}
                tick={{ fill: colors.chart.axis, fontSize: chartLayout.yTickFontSize }}
                width={chartLayout.yAxisWidth}
                tickMargin={6}
              />
              <Tooltip
                wrapperStyle={{ display: 'none' }}
                cursor={
                  hoverInfo
                    ? {
                        fill: 'transparent',
                        stroke: colors.chart.primary[0],
                        strokeWidth: 2,
                        radius: 4,
                      }
                    : false
                }
              />
              <Bar
                dataKey="cash"
                name={ACCOUNT_GROUP_LABELS.cash}
                stackId="pos"
                fill={colors.semantic.cash}
                legendType="circle"
                onMouseEnter={(entry) => handleBarHover(entry)}
                onMouseLeave={() => setHoverInfo(null)}
              />
              <Bar
                dataKey="investments"
                name={ACCOUNT_GROUP_LABELS.investments}
                stackId="pos"
                fill={colors.semantic.investments}
                legendType="circle"
                onMouseEnter={(entry) => handleBarHover(entry)}
                onMouseLeave={() => setHoverInfo(null)}
              />
              <Bar
                dataKey="credit"
                name={ACCOUNT_GROUP_LABELS.credit}
                stackId="neg"
                fill={colors.semantic.credit}
                legendType="circle"
                onMouseEnter={(entry) => handleBarHover(entry)}
                onMouseLeave={() => setHoverInfo(null)}
              />
              <Bar
                dataKey="loan"
                name={ACCOUNT_GROUP_LABELS.loans}
                stackId="neg"
                fill={colors.semantic.loan}
                legendType="circle"
                onMouseEnter={(entry) => handleBarHover(entry)}
                onMouseLeave={() => setHoverInfo(null)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default BalancesOverview;
