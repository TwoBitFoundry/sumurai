/**
 * Cash flow chart showing monthly income, expenses, and net savings.
 */

import type React from 'react';
import type { TooltipProps } from 'recharts';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';
import type { AnalyticsCashFlowPoint } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import { ChartGlassTooltip, chartTooltipRechartsProps } from './ChartGlassTooltip';

export interface CashFlowChartProps {
  data: AnalyticsCashFlowPoint[];
  width: number;
  height: number;
}

const cashFlowTooltipFormatter: TooltipProps<number, string>['formatter'] = (value) => {
  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
  return fmtUSD(Number.isFinite(numericValue) ? numericValue : 0);
};

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, width, height }) => {
  const { colors } = useTheme();

  return (
    <ComposedChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      accessibilityLayer={false}
    >
      <defs>
        <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={colors.semantic.cash} stopOpacity={0.4} />
          <stop offset="95%" stopColor={colors.semantic.cash} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke={colors.chart.grid} />
      <XAxis
        dataKey="month"
        tick={{ fill: colors.chart.axis, fontSize: 12 }}
        axisLine={false}
        tickLine={false}
        interval="preserveStartEnd"
        minTickGap={24}
        tickFormatter={(value: string) => {
          try {
            const [year, month] = value.split('-');
            if (!year || !month) return value;
            const date = new Date(`${year}-${month}-01`);
            if (!Number.isFinite(date.getTime())) return value;
            const shortMonth = date.toLocaleString('en-US', { month: 'short' });
            const shortYear = date.toLocaleString('en-US', { year: '2-digit' });
            return `${shortMonth} '${shortYear}`;
          } catch {
            return value;
          }
        }}
      />
      <YAxis
        tick={{ fill: colors.chart.axis, fontSize: 12 }}
        axisLine={false}
        tickLine={false}
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
        cursor={false}
        content={(tooltipProps) => (
          <ChartGlassTooltip
            {...tooltipProps}
            formatter={cashFlowTooltipFormatter}
            valueClassName="text-success"
          />
        )}
        {...chartTooltipRechartsProps}
      />
      <ReferenceLine y={0} stroke={colors.chart.axis} strokeDasharray="3 3" />
      <Bar
        dataKey="income"
        fill={colors.semantic.cash}
        name="Income"
        radius={[4, 4, 0, 0]}
        isAnimationActive={false}
      />
      <Bar
        dataKey="expenses"
        fill={colors.semantic.credit}
        name="Expenses"
        radius={[4, 4, 0, 0]}
        isAnimationActive={false}
      />
      <Line
        type="monotone"
        dataKey="net"
        stroke={colors.semantic.netWorth || colors.semantic.cash}
        strokeWidth={2}
        dot={false}
        name="Net"
        isAnimationActive={false}
      />
    </ComposedChart>
  );
};
