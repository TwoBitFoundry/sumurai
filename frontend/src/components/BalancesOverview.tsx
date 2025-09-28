import React, { useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Amount, fmtUSD } from "./Amount";
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

  // Bank names should come from the API. No client-side overrides.

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
  // Start from 12px; shrink as labels grow longer
  let yTickFontSize = 12;
  if (maxLabelLen >= 14) yTickFontSize = 11;
  if (maxLabelLen >= 16) yTickFontSize = 10;
  if (maxLabelLen >= 18) yTickFontSize = 9;
  // Estimate width so labels aren't clipped; cap to avoid over-reserving space
  const approxCharWidth = yTickFontSize * 0.62; // rough average
  const yAxisWidth = Math.min(120, Math.ceil(maxLabelLen * approxCharWidth) + 12);

  // Hover state for a custom, non-occluding info panel
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

  // Use a single accent stroke that reads in both themes
  const cursorStroke = useMemo(() => "#38bdf8", []); // sky-400

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-6 shadow-lg overflow-hidden">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Balances Overview</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Assets vs liabilities across your banks</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && refreshing && (
            <RefreshCcw
              aria-label="Refreshing balances"
              className="h-4 w-4 text-slate-500 dark:text-slate-400 animate-spin"
            />
          )}
          <RatioPill ratio={data?.overall?.ratio ?? null} />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div data-testid="balances-loading" className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div data-testid="balances-error" className="mb-4 flex items-center justify-between rounded-xl border border-rose-200/60 dark:border-rose-600/40 bg-rose-50/60 dark:bg-rose-900/20 p-3 text-sm text-rose-700 dark:text-rose-300">
          <span>Failed to load balances. {error}</span>
          <button onClick={refresh} className="rounded-md bg-rose-600 text-white px-3 py-1 text-xs hover:bg-rose-700">Retry</button>
        </div>
      )}

      {/* Overall cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl p-4 bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60">
          <div className="text-xs text-slate-500">Net</div>
          <div className="text-lg font-semibold" data-testid="overall-net"><Amount value={data?.overall?.net ?? 0} /></div>
        </div>
        <div className="rounded-xl p-4 bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
          <div className="text-xs text-emerald-700 dark:text-emerald-300">Cash</div>
          <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300" data-testid="overall-cash">{fmtUSD(data?.overall?.cash ?? 0)}</div>
        </div>
        <div className="rounded-xl p-4 bg-cyan-50/60 dark:bg-cyan-500/10 border border-cyan-200/60 dark:border-cyan-500/20">
          <div className="text-xs text-cyan-700 dark:text-cyan-300">Investments</div>
          <div className="text-lg font-semibold text-cyan-700 dark:text-cyan-300" data-testid="overall-investments">{fmtUSD(data?.overall?.investments ?? 0)}</div>
        </div>
        <div className="rounded-xl p-4 bg-rose-50/60 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/20">
          <div className="text-xs text-rose-700 dark:text-rose-300">Credit</div>
          <div className="text-lg font-semibold text-rose-700 dark:text-rose-300" data-testid="overall-credit">{fmtUSD(data?.overall?.credit ?? 0)}</div>
        </div>
        <div className="rounded-xl p-4 bg-red-50/60 dark:bg-red-600/10 border border-red-200/60 dark:border-red-600/20">
          <div className="text-xs text-red-700 dark:text-red-300">Loan</div>
          <div className="text-lg font-semibold text-red-700 dark:text-red-300" data-testid="overall-loan">{fmtUSD(data?.overall?.loan ?? 0)}</div>
        </div>
      </div>

      {/* Reserved space for hover panel so layout doesn't shift */}
      <div className="relative h-12 mb-2">
        {hoverInfo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
            <div className="whitespace-nowrap rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 backdrop-blur px-3 py-2 shadow-lg text-xs sm:text-sm flex items-center gap-4">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{hoverInfo.bank}</span>
              <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />Cash: {fmtUSD(hoverInfo.cash ?? 0)}</span>
              <span className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300"><span className="inline-block w-2 h-2 rounded-full bg-cyan-500" />Investments: {fmtUSD(hoverInfo.investments ?? 0)}</span>
              <span className="flex items-center gap-2 text-rose-700 dark:text-rose-300"><span className="inline-block w-2 h-2 rounded-full bg-rose-500" />Credit: {fmtUSD(hoverInfo.credit ?? 0)}</span>
              <span className="flex items-center gap-2 text-red-700 dark:text-red-300"><span className="inline-block w-2 h-2 rounded-full bg-red-600" />Loan: {fmtUSD(hoverInfo.loan ?? 0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Per-bank stacked bar chart */}
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
            {/**
             * Keep a hover cursor but switch to an outline highlight only.
             * Hide the default tooltip entirely to avoid covering the chart;
             * we render a custom panel above the chart instead.
             */}
            <Tooltip
              wrapperStyle={{ display: "none" }}
              cursor={hoverInfo ? { fill: "transparent", stroke: cursorStroke, strokeWidth: 2, radius: 4 } : false}
            />
            <Legend verticalAlign="bottom" height={28} iconSize={10} wrapperStyle={{ paddingTop: 4 }} />
            {/* Positives */}
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
            {/* Negatives below axis */}
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

      {/* Labels beneath chart with bank name and ratio */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {(data?.banks || []).map((b) => (
          <div key={b.bankId} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-slate-900/30 p-3 flex items-center justify-between">
            <div className="text-sm font-medium">{b.bankName}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span>Ratio</span>
              <span data-testid={`bank-${b.bankName}-ratio`}>{formatRatio(b.ratio)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BalancesOverview;
