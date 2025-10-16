import React, { useMemo, useState } from "react";
import {
  CircleDollarSign,
  HandCoins,
  LineChart,
  PiggyBank,
  RefreshCcw,
  CreditCard,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Amount, fmtUSD } from "./Amount";
import HeroStatCard from "./widgets/HeroStatCard";
import { useBalancesOverview } from "../hooks/useBalancesOverview";
import { formatRatio } from "../services/AnalyticsService";
import { useTheme } from "../context/ThemeContext";
import { Alert, Badge, Button, GlassCard, cn } from "../ui/primitives";

type BankBarDatum = {
  bank: string;
  cash: number | null;
  investments: number | null;
  credit: number | null;
  loan: number | null;
};

function RatioPill({ ratio }: { ratio: number | string | null }) {
  const label = formatRatio(ratio);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        "border-slate-200 bg-white/70 text-slate-600",
        "dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
      )}
    >
      A/L: {label}
    </span>
  );
}

export function BalancesOverview() {
  const { loading, refreshing, error, data, refresh } = useBalancesOverview();
  const { colors } = useTheme();

  const banks = data?.banks || [];
  const overall = data?.overall;

  const fmtAxis = (n: number) => {
    const sign = n < 0 ? "-" : "";
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
    return `${sign}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(absolute)}`;
  };

  const maxPositive = banks.length
    ? Math.max(0, ...banks.map((b) => (b.cash || 0) + (b.investments || 0)))
    : 0;
  const maxNegativeAbs = banks.length
    ? Math.max(0, ...banks.map((b) => Math.abs((b.credit || 0) + (b.loan || 0))))
    : 0;
  const maxAbs = Math.max(maxPositive, maxNegativeAbs);
  const maxLabelLen = Math.max(fmtAxis(maxAbs).length, fmtAxis(-maxAbs).length);
  let yTickFontSize = 12;
  if (maxLabelLen >= 14) yTickFontSize = 11;
  if (maxLabelLen >= 16) yTickFontSize = 10;
  if (maxLabelLen >= 18) yTickFontSize = 9;
  const approxCharWidth = yTickFontSize * 0.62;
  const yAxisWidth = Math.min(120, Math.ceil(maxLabelLen * approxCharWidth) + 12);

  const chartData = useMemo<BankBarDatum[]>(
    () =>
      (data?.banks || []).map((b) => ({
        bank: b.bankName,
        cash: b.cash,
        investments: b.investments,
        credit: b.credit,
        loan: b.loan,
      })),
    [data?.banks]
  );

  const [hoverInfo, setHoverInfo] = useState<
    | {
        bank: string;
        cash?: number | null;
        investments?: number | null;
        credit?: number | null;
        loan?: number | null;
      }
    | null
  >(null);

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
        key: "net",
        title: "Net",
        accent: "violet" as const,
        icon: <CircleDollarSign className={cn('h-4', 'w-4')} />,
        value: (
          <span data-testid="overall-net">
            <Amount value={overall?.net ?? 0} className={cn('text-violet-500', 'dark:text-violet-300')} />
          </span>
        ),
      },
      {
        key: "cash",
        title: "Cash",
        accent: "emerald" as const,
        icon: <PiggyBank className={cn('h-4', 'w-4')} />,
        value: (
          <span data-testid="overall-cash" className={cn('text-emerald-500', 'dark:text-emerald-300')}>
            {fmtUSD(overall?.cash ?? 0)}
          </span>
        ),
      },
      {
        key: "investments",
        title: "Investments",
        accent: "sky" as const,
        icon: <LineChart className={cn('h-4', 'w-4')} />,
        value: (
          <span data-testid="overall-investments" className={cn('text-sky-500', 'dark:text-sky-300')}>
            {fmtUSD(overall?.investments ?? 0)}
          </span>
        ),
      },
      {
        key: "credit",
        title: "Credit",
        accent: "rose" as const,
        icon: <CreditCard className={cn('h-4', 'w-4')} />,
        value: (
          <span data-testid="overall-credit" className={cn('text-rose-500', 'dark:text-rose-300')}>
            {fmtUSD(overall?.credit ?? 0)}
          </span>
        ),
      },
      {
        key: "loan",
        title: "Loan",
        accent: "amber" as const,
        icon: <HandCoins className={cn('h-4', 'w-4')} />,
        value: (
          <span data-testid="overall-loan" className={cn('text-amber-600', 'dark:text-amber-400')}>
            {fmtUSD(overall?.loan ?? 0)}
          </span>
        ),
      },
    ],
    [overall?.cash, overall?.credit, overall?.investments, overall?.loan, overall?.net]
  );

  return (
    <GlassCard variant="default" rounded="xl" padding="lg" className="space-y-6">
      <div className={cn("flex flex-col gap-6", "lg:flex-row lg:items-start lg:justify-between")}>
        <div className="space-y-4">
          <Badge
            variant="feature"
            size="sm"
            className={cn(
              'rounded-full',
              'px-3',
              'py-1',
              'tracking-[0.32em]',
              'shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)]',
              'bg-white/75',
              'text-slate-600',
              'ring-0',
              'dark:bg-[#1e293b]/75',
              'dark:text-slate-200'
            )}
          >
            Dashboard
          </Badge>
          <div className="space-y-3">
            <h1 className={cn('text-3xl', 'font-bold', 'text-slate-900', 'dark:text-white', 'sm:text-4xl')}>
              Overview of Balances
            </h1>
            <p className={cn('text-base', 'text-slate-600', 'dark:text-slate-300')}>
              Track your assets and liabilities across all connected accounts with real-time balance updates.
            </p>
          </div>
        </div>
        <div className={cn('flex', 'items-center', 'gap-3')}>
          {!loading && refreshing && (
            <RefreshCcw
              aria-label="Refreshing balances"
              className={cn("h-4 w-4 text-slate-500 dark:text-slate-400", refreshing && "animate-spin")}
            />
          )}
          <RatioPill ratio={data?.overall?.ratio ?? null} />
        </div>
      </div>

      {loading && (
        <div data-testid="balances-loading" className={cn('grid', 'gap-3', 'sm:grid-cols-2', 'lg:grid-cols-5')}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-16 rounded-xl border bg-slate-100/60",
                "border-slate-200/60 dark:border-slate-700/60 dark:bg-slate-900/40"
              )}
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <Alert variant="error" title="Balances unavailable" className={cn('flex', 'items-center', 'justify-between', 'gap-3')}>
          <span>Failed to load balances. {error}</span>
          <Button variant="danger" size="sm" onClick={refresh}>
            Retry
          </Button>
        </Alert>
      )}

      <div className={cn('grid', 'gap-3', '[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]')}>
        {overviewCards.map((card) => (
          <HeroStatCard
            key={card.key}
            title={card.title}
            value={card.value}
            icon={card.icon}
            accent={card.accent}
            className="h-full"
            minHeightClassName="min-h-0"
          />
        ))}
      </div>

      <div className={cn('relative', 'h-12')}>
        {hoverInfo && (
          <div className={cn('pointer-events-none', 'absolute', 'inset-0', 'grid', 'place-items-center')}>
            <GlassCard
              variant="accent"
              rounded="lg"
              padding="sm"
              withInnerEffects={false}
              className={cn(
                "flex flex-wrap items-center gap-3 text-xs",
                "text-slate-700 dark:text-slate-200"
              )}
            >
              <span className="font-semibold">{hoverInfo.bank}</span>
              <span className={cn('flex', 'items-center', 'gap-1', 'text-emerald-600', 'dark:text-emerald-300')}>
                <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-emerald-500')} />
                Cash: {fmtUSD(hoverInfo.cash ?? 0)}
              </span>
              <span className={cn('flex', 'items-center', 'gap-1', 'text-cyan-600', 'dark:text-cyan-300')}>
                <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-cyan-500')} />
                Investments: {fmtUSD(hoverInfo.investments ?? 0)}
              </span>
              <span className={cn('flex', 'items-center', 'gap-1', 'text-rose-600', 'dark:text-rose-300')}>
                <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-rose-500')} />
                Credit: {fmtUSD(hoverInfo.credit ?? 0)}
              </span>
              <span className={cn('flex', 'items-center', 'gap-1', 'text-amber-600', 'dark:text-amber-300')}>
                <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-amber-500')} />
                Loan: {fmtUSD(hoverInfo.loan ?? 0)}
              </span>
            </GlassCard>
          </div>
        )}
      </div>

      <div className={cn('h-64', 'w-full', 'min-w-0')}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            stackOffset="sign"
            margin={{ top: 8, right: 16, left: 16, bottom: 24 }}
            onMouseLeave={() => setHoverInfo(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
            <XAxis dataKey="bank" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis
              tickFormatter={(value) => fmtAxis(value as number)}
              tick={{ fill: "#94a3b8", fontSize: yTickFontSize }}
              width={yAxisWidth}
              tickMargin={6}
            />
            <Tooltip wrapperStyle={{ display: "none" }} cursor={hoverInfo ? { fill: "transparent", stroke: "#38bdf8", strokeWidth: 2, radius: 4 } : false} />
            <Legend verticalAlign="bottom" height={28} iconSize={10} wrapperStyle={{ paddingTop: 4 }} />
            <Bar
              dataKey="cash"
              name="Cash"
              stackId="pos"
              fill={colors.semantic.cash}
              legendType="circle"
              onMouseEnter={(entry) => handleBarHover(entry)}
              onMouseLeave={() => setHoverInfo(null)}
            />
            <Bar
              dataKey="investments"
              name="Investments"
              stackId="pos"
              fill={colors.semantic.investments}
              legendType="circle"
              onMouseEnter={(entry) => handleBarHover(entry)}
              onMouseLeave={() => setHoverInfo(null)}
            />
            <Bar
              dataKey="credit"
              name="Credit"
              stackId="neg"
              fill={colors.semantic.credit}
              legendType="circle"
              onMouseEnter={(entry) => handleBarHover(entry)}
              onMouseLeave={() => setHoverInfo(null)}
            />
            <Bar
              dataKey="loan"
              name="Loan"
              stackId="neg"
              fill={colors.semantic.loan}
              legendType="circle"
              onMouseEnter={(entry) => handleBarHover(entry)}
              onMouseLeave={() => setHoverInfo(null)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

export default BalancesOverview;