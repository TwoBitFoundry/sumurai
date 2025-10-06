import React, { useMemo, useState } from "react";
import { CircleDollarSign, HandCoins, LineChart, PiggyBank, RefreshCcw, CreditCard } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Amount, fmtUSD } from "./Amount";
import HeroStatCard from "./widgets/HeroStatCard";
import { useBalancesOverview } from "../hooks/useBalancesOverview";
import { formatRatio } from "../services/AnalyticsService";

function RatioPill({ ratio }: { ratio: number | string | null }) {
  const label = formatRatio(ratio as any);
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 px-2 py-0.5 text-xs font-medium">
      A/L: {label}
    </span>
  );
}

export function BalancesOverview() {
  const { loading, refreshing, error, data, refresh } = useBalancesOverview();

  const banks = data?.banks || [];
  const fmtAxis = (n: number) => {
    const s = n < 0 ? "-" : "";
    const a = Math.abs(n);
    if (a >= 1e12) return s + Math.round(a / 1e12) + "T";
    if (a >= 1e9) {
      const r = Math.round(a / 1e9);
      if (r >= 1000) return s + "1T";
      return s + r + "B";
    }
    if (a >= 1e6) {
      const r = Math.round(a / 1e6);
      if (r >= 1000) return s + "1B";
      return s + r + "M";
    }
    if (a >= 1e4) {
      const r = Math.round(a / 1e3);
      if (r >= 1000) return s + "1M";
      return s + r + "k";
    }
    return (s ? "-" : "") + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(a);
  };
  const maxPositive = banks.length
    ? Math.max(
        0,
        ...banks.map((b) => (b.cash || 0) + (b.investments || 0))
      )
    : 0;
  const maxNegativeAbs = banks.length
    ? Math.max(
        0,
        ...banks.map((b) => Math.abs((b.credit || 0) + (b.loan || 0)))
      )
    : 0;
  const maxAbs = Math.max(maxPositive, maxNegativeAbs);
  const maxLabelLen = Math.max(fmtAxis(maxAbs).length, fmtAxis(-maxAbs).length);
  let yTickFontSize = 12;
  if (maxLabelLen >= 14) yTickFontSize = 11;
  if (maxLabelLen >= 16) yTickFontSize = 10;
  if (maxLabelLen >= 18) yTickFontSize = 9;
  const approxCharWidth = yTickFontSize * 0.62;
  const yAxisWidth = Math.min(120, Math.ceil(maxLabelLen * approxCharWidth) + 12);

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

  const cursorStroke = useMemo(() => "#38bdf8", []);
  const overall = data?.overall;

  const overviewCards = useMemo(
    () => [
      {
        key: "net",
        title: "Net",
        accent: "slate" as const,
        icon: <CircleDollarSign className="h-4 w-4" />,
        value: (
          <span data-testid="overall-net">
            <Amount value={overall?.net ?? 0} />
          </span>
        ),
      },
      {
        key: "cash",
        title: "Cash",
        accent: "emerald" as const,
        icon: <PiggyBank className="h-4 w-4" />,
        value: (
          <span
            data-testid="overall-cash"
            className="text-emerald-500 dark:text-emerald-300"
          >
            {fmtUSD(overall?.cash ?? 0)}
          </span>
        ),
      },
      {
        key: "investments",
        title: "Investments",
        accent: "sky" as const,
        icon: <LineChart className="h-4 w-4" />,
        value: (
          <span
            data-testid="overall-investments"
            className="text-sky-500 dark:text-sky-300"
          >
            {fmtUSD(overall?.investments ?? 0)}
          </span>
        ),
      },
      {
        key: "credit",
        title: "Credit",
        accent: "rose" as const,
        icon: <CreditCard className="h-4 w-4" />,
        value: (
          <span
            data-testid="overall-credit"
            className="text-rose-500 dark:text-rose-300"
          >
            {fmtUSD(overall?.credit ?? 0)}
          </span>
        ),
      },
      {
        key: "loan",
        title: "Loan",
        accent: "rose" as const,
        icon: <HandCoins className="h-4 w-4" />,
        value: (
          <span
            data-testid="overall-loan"
            className="text-rose-600 dark:text-rose-400"
          >
            {fmtUSD(overall?.loan ?? 0)}
          </span>
        ),
      },
    ],
    [overall?.cash, overall?.credit, overall?.investments, overall?.loan, overall?.net]
  );

  return (
    <section className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/24 p-8 shadow-[0_45px_140px_-80px_rgba(15,23,42,0.82)] backdrop-blur-2xl backdrop-saturate-[160%] transition-colors duration-500 ease-out sm:p-12 dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_48px_160px_-82px_rgba(2,6,23,0.85)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(15,23,42,0.12)] dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
        <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-b from-white/70 via-white/28 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#475569] shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-[#cbd5e1]">
              Dashboard
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 transition-colors duration-300 ease-out dark:text-white sm:text-4xl">
                Overview of Balances
              </h1>
              <p className="text-base leading-relaxed text-slate-600 transition-colors duration-300 ease-out dark:text-slate-300">
                Track your assets and liabilities across all connected accounts with real-time balance updates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!loading && refreshing && (
              <RefreshCcw
                aria-label="Refreshing balances"
                className="h-4 w-4 text-slate-500 dark:text-slate-400 animate-spin"
              />
            )}
            <RatioPill ratio={data?.overall?.ratio ?? null} />
          </div>
        </div>

        {loading && (
          <div data-testid="balances-loading" className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div data-testid="balances-error" className="flex items-center justify-between rounded-xl border border-rose-200/70 dark:border-rose-600/40 bg-rose-50/80 dark:bg-rose-900/25 p-3 text-sm text-rose-700 dark:text-rose-300">
            <span>Failed to load balances. {error}</span>
            <button onClick={refresh} className="rounded-md bg-rose-600 text-white px-3 py-1 text-xs hover:bg-rose-700">Retry</button>
          </div>
        )}

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {overviewCards.map((card) => (
            <HeroStatCard
              key={card.key}
              title={card.title}
              value={card.value}
              icon={card.icon}
              accent={card.accent}
              className="h-full"
            />
          ))}
        </div>

        <div className="relative h-12">
          {hoverInfo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
              <div className="whitespace-nowrap rounded-lg border border-white/55 dark:border-white/10 bg-white/90 dark:bg-[#111a2f]/90 backdrop-blur px-3 py-2 shadow-lg text-xs sm:text-sm flex items-center gap-4">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{hoverInfo.bank}</span>
                <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />Cash: {fmtUSD(hoverInfo.cash ?? 0)}</span>
                <span className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300"><span className="inline-block w-2 h-2 rounded-full bg-cyan-500" />Investments: {fmtUSD(hoverInfo.investments ?? 0)}</span>
                <span className="flex items-center gap-2 text-rose-700 dark:text-rose-300"><span className="inline-block w-2 h-2 rounded-full bg-rose-500" />Credit: {fmtUSD(hoverInfo.credit ?? 0)}</span>
                <span className="flex items-center gap-2 text-red-700 dark:text-red-300"><span className="inline-block w-2 h-2 rounded-full bg-red-600" />Loan: {fmtUSD(hoverInfo.loan ?? 0)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={(data?.banks || []).map(b => ({
                bank: b.bankName,
                cash: b.cash,
                investments: b.investments,
                credit: b.credit,
                loan: b.loan,
              }))}
              stackOffset="sign"
              margin={{ top: 8, right: 16, left: 16, bottom: 24 }}
              onMouseLeave={() => setHoverInfo(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis dataKey="bank" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis
                tickFormatter={(v) => fmtAxis(v as number)}
                tick={{ fill: "#94a3b8", fontSize: yTickFontSize }}
                width={yAxisWidth}
                tickMargin={6}
              />
              <Tooltip
                wrapperStyle={{ display: "none" }}
                cursor={hoverInfo ? { fill: "transparent", stroke: cursorStroke, strokeWidth: 2, radius: 4 } : false}
              />
              <Legend verticalAlign="bottom" height={28} iconSize={10} wrapperStyle={{ paddingTop: 4 }} />
              <Bar
                dataKey="cash"
                name="Cash"
                stackId="pos"
                fill="#10b981"
                legendType="circle"
                onMouseEnter={(entry: any) => {
                  const p = entry?.payload as any;
                  if (p) setHoverInfo({ bank: p.bank, cash: p.cash, investments: p.investments, credit: p.credit, loan: p.loan });
                }}
                onMouseLeave={() => setHoverInfo(null)}
              />
              <Bar
                dataKey="investments"
                name="Investments"
                stackId="pos"
                fill="#06b6d4"
                legendType="circle"
                onMouseEnter={(entry: any) => {
                  const p = entry?.payload as any;
                  if (p) setHoverInfo({ bank: p.bank, cash: p.cash, investments: p.investments, credit: p.credit, loan: p.loan });
                }}
                onMouseLeave={() => setHoverInfo(null)}
              />
              <Bar
                dataKey="credit"
                name="Credit"
                stackId="neg"
                fill="#fb7185"
                legendType="circle"
                onMouseEnter={(entry: any) => {
                  const p = entry?.payload as any;
                  if (p) setHoverInfo({ bank: p.bank, cash: p.cash, investments: p.investments, credit: p.credit, loan: p.loan });
                }}
                onMouseLeave={() => setHoverInfo(null)}
              />
              <Bar
                dataKey="loan"
                name="Loan"
                stackId="neg"
                fill="#dc2626"
                legendType="circle"
                onMouseEnter={(entry: any) => {
                  const p = entry?.payload as any;
                  if (p) setHoverInfo({ bank: p.bank, cash: p.cash, investments: p.investments, credit: p.credit, loan: p.loan });
                }}
                onMouseLeave={() => setHoverInfo(null)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {(data?.banks || []).map((b) => (
            <div key={b.bankId} className="rounded-2xl border border-white/55 dark:border-white/10 bg-white/80 dark:bg-[#111a2f]/70 p-3 flex items-center justify-between shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] transition-colors duration-500">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{b.bankName}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <span>Ratio</span>
                <span data-testid={`bank-${b.bankName}-ratio`}>{formatRatio(b.ratio)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default BalancesOverview;
