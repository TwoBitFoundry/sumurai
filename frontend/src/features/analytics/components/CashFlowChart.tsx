/**
 * Cash flow chart showing monthly income, expenses, and net savings.
 */

import React, { useId, useMemo } from 'react';
import type { CurveProps, TooltipContentProps } from 'recharts';
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
import { budgetRealityChart, netWorthLineChart, text as uiTextRecipes } from '@/ui/recipes';
import { useTheme } from '../../../context/ThemeContext';
import type { AnalyticsCashFlowPoint } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import { formatChartMonthLabel } from '../utils/chartMonth';
import { ChartGlassTooltip, chartTooltipRechartsProps } from './ChartGlassTooltip';
import { ChartGlowLineCurve, ChartGlowLineFilter } from './ChartGlowLineCurve';
import { chartSeriesDotProps } from './ChartSeriesMarkers';
import { NetWorthGlowLineCurve, netWorthLineGlowFilterId } from './NetWorthGlowLineCurve';

export interface CashFlowChartProps {
  data: AnalyticsCashFlowPoint[];
  width: number;
  height: number;
}

type CashFlowChartDatum = AnalyticsCashFlowPoint & {
  plottedExpenses: number;
};

const budgetRealityGlowLineStyle = {
  blurStdDeviation: budgetRealityChart.curveGlow.blurStdDeviation,
  glowStrokeWidth: budgetRealityChart.curveGlow.strokeWidth,
  glowOpacity: budgetRealityChart.curveGlow.opacity,
  lineStrokeWidth: 2,
} as const;

const cashFlowTooltipFormatter: TooltipContentProps<number, string>['formatter'] = (
  value,
  name,
  entry
) => {
  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
  const normalizedValue =
    String(entry?.dataKey ?? name ?? '') === 'plottedExpenses'
      ? Math.abs(numericValue)
      : numericValue;
  return fmtUSD(Number.isFinite(normalizedValue) ? normalizedValue : 0);
};

const cashFlowTooltipValueClassName = (
  entry: NonNullable<TooltipContentProps<number, string>['payload']>[number]
) => {
  const key = String(entry.dataKey ?? entry.name ?? '');
  if (key === 'income') return uiTextRecipes.success;
  if (key === 'expenses' || key === 'plottedExpenses') return uiTextRecipes.danger;
  if (key === 'net') return uiTextRecipes.info;
  return undefined;
};

const CashFlowChartFn: React.FC<CashFlowChartProps> = ({ data, width, height }) => {
  const { colors, mode } = useTheme();
  const idBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const netGlowFilterId = netWorthLineGlowFilterId(idBase);
  const incomeGlowFilterId = `${idBase}-income-curve-glow`;
  const expenseGlowFilterId = `${idBase}-expense-curve-glow`;
  const netWorthStroke = netWorthLineChart.stroke[mode];
  const incomeColor = colors.semantic.cash;
  const expenseColor = colors.semantic.credit;
  const incomeDots = chartSeriesDotProps(incomeColor);
  const expenseDots = chartSeriesDotProps(expenseColor);
  const netDots = chartSeriesDotProps(netWorthStroke);
  const chartData = useMemo<CashFlowChartDatum[]>(
    () =>
      data.map((point) => ({
        ...point,
        income: Number(point.income),
        expenses: Number(point.expenses),
        net: Number(point.net),
        plottedExpenses: -Math.abs(Number(point.expenses)),
      })),
    [data]
  );
  return (
    <AreaChart
      width={width}
      height={height}
      data={chartData}
      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      accessibilityLayer={false}
    >
      <defs>
        <ChartGlowLineFilter
          filterId={netGlowFilterId}
          blurStdDeviation={netWorthLineChart.curveGlow.blurStdDeviation}
        />
        <ChartGlowLineFilter
          filterId={incomeGlowFilterId}
          blurStdDeviation={budgetRealityChart.curveGlow.blurStdDeviation}
        />
        <ChartGlowLineFilter
          filterId={expenseGlowFilterId}
          blurStdDeviation={budgetRealityChart.curveGlow.blurStdDeviation}
        />
        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={incomeColor} stopOpacity={0.6} />
          <stop offset="95%" stopColor={incomeColor} stopOpacity={0.1} />
        </linearGradient>
        <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={expenseColor} stopOpacity={0.6} />
          <stop offset="95%" stopColor={expenseColor} stopOpacity={0.1} />
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
            labelFormatter={(label) => formatChartMonthLabel(String(label))}
            valueClassNameForEntry={cashFlowTooltipValueClassName}
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
        stroke="none"
        strokeWidth={0}
        dot={false}
        activeDot={false}
        name="Income"
        isAnimationActive={true}
        animationBegin={0}
        animationDuration={budgetRealityChart.animationDurationMs}
      />
      <Area
        type="monotone"
        dataKey="plottedExpenses"
        fill="url(#expensesGradient)"
        stroke="none"
        strokeWidth={0}
        dot={false}
        activeDot={false}
        name="Expenses"
        isAnimationActive={true}
        animationBegin={0}
        animationDuration={budgetRealityChart.animationDurationMs}
      />
      <Line
        type="monotone"
        dataKey="income"
        stroke={incomeColor}
        strokeWidth={budgetRealityGlowLineStyle.lineStrokeWidth}
        {...incomeDots}
        legendType="none"
        tooltipType="none"
        shape={(curveProps: CurveProps) => (
          <ChartGlowLineCurve
            curveProps={curveProps}
            stroke={incomeColor}
            filterId={incomeGlowFilterId}
            style={budgetRealityGlowLineStyle}
          />
        )}
        isAnimationActive={true}
        animationBegin={0}
        animationDuration={budgetRealityChart.animationDurationMs}
      />
      <Line
        type="monotone"
        dataKey="plottedExpenses"
        stroke={expenseColor}
        strokeWidth={budgetRealityGlowLineStyle.lineStrokeWidth}
        {...expenseDots}
        legendType="none"
        tooltipType="none"
        shape={(curveProps: CurveProps) => (
          <ChartGlowLineCurve
            curveProps={curveProps}
            stroke={expenseColor}
            filterId={expenseGlowFilterId}
            style={budgetRealityGlowLineStyle}
          />
        )}
        isAnimationActive={true}
        animationBegin={0}
        animationDuration={budgetRealityChart.animationDurationMs}
      />
      <Line
        type="monotone"
        dataKey="net"
        stroke={netWorthStroke}
        strokeWidth={netWorthLineChart.lineStrokeWidth}
        {...netDots}
        name="Net"
        shape={(curveProps: CurveProps) => (
          <NetWorthGlowLineCurve
            curveProps={curveProps}
            stroke={netWorthStroke}
            filterId={netGlowFilterId}
          />
        )}
        isAnimationActive={true}
        animationBegin={0}
        animationDuration={budgetRealityChart.animationDurationMs}
      />
    </AreaChart>
  );
};
export const CashFlowChart = React.memo(CashFlowChartFn);
