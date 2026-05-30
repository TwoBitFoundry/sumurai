/**
 * Cash flow chart showing monthly income, expenses, and net savings.
 */

import React from 'react';
import type { TooltipProps } from 'recharts';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';
import type { AnalyticsCashFlowPoint } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import { formatChartMonthLabel } from '../utils/chartMonth';
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

const CashFlowChartFn: React.FC<CashFlowChartProps> = ({ data, width, height }) => {
  const { colors } = useTheme();
  return (
    <AreaChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      accessibilityLayer={false}
    >
      <defs>
        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={colors.semantic.cash} stopOpacity={0.6} />
          <stop offset="95%" stopColor={colors.semantic.cash} stopOpacity={0.1} />
        </linearGradient>
        <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={colors.semantic.credit} stopOpacity={0.6} />
          <stop offset="95%" stopColor={colors.semantic.credit} stopOpacity={0.1} />
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
        tickFormatter={(value: string) => formatChartMonthLabel(value)}
      />
      <YAxis
        tick={{ fill: colors.chart.axis, fontSize: 12 }}
        axisLine={false}
        tickLine={false}
        tickCount={Math.min(7, Math.max(3, Math.floor(height / 50)))}
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
      <Area
        type="monotone"
        dataKey="income"
        stackId="flow"
        fill="url(#incomeGradient)"
        stroke={colors.semantic.cash}
        strokeWidth={0}
        name="Income"
        isAnimationActive={true}
        animationBegin={0}
        animationDuration={800}
      />
      <Area
        type="monotone"
        dataKey="expenses"
        stackId="flow"
        fill="url(#expensesGradient)"
        stroke={colors.semantic.credit}
        strokeWidth={0}
        name="Expenses"
        isAnimationActive={true}
        animationBegin={0}
        animationDuration={800}
      />
      <Line
        type="monotone"
        dataKey="net"
        stroke={colors.semantic.netWorth || colors.chart.axis}
        strokeWidth={2}
        dot={false}
        name="Net"
        isAnimationActive={true}
        animationBegin={0}
        animationDuration={800}
      />
    </AreaChart>
  );
};
export const CashFlowChart = React.memo(CashFlowChartFn);
