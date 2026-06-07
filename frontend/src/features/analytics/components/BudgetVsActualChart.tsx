import React, { useId, useMemo } from 'react';
import type { CurveProps, TooltipProps } from 'recharts';
import {
  CartesianGrid,
  Curve,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';
import { fmtUSD } from '../../../utils/format';
import { realityChartDomain } from '../utils/budgetChartAxis';
import { formatChartMonthLabel } from '../utils/chartMonth';
import { cn } from '@/ui/primitives';
import { font, text as uiTextRecipes } from '@/ui/recipes';
import { ChartGlassTooltip, chartTooltipRechartsProps } from './ChartGlassTooltip';

export interface BudgetVsActualChartData {
  month: string;
  expenses: number;
}

export interface BudgetVsActualChartProps {
  data: BudgetVsActualChartData[];
  totalBudget: number;
  width: number;
  height: number;
}

function realityMarkerColor(expenses: number, totalBudget: number, underColor: string, overColor: string) {
  return Number(expenses) > Number(totalBudget) ? overColor : underColor;
}

const CHART_ANIMATION_MS = 800;

function BudgetRealityCurve({ curveProps, stroke }: { curveProps: CurveProps; stroke: string }) {
  const { strokeDasharray: _strokeDasharray, ...curveWithoutDash } = curveProps;
  return <Curve {...curveWithoutDash} stroke={stroke} strokeWidth={2} fill="none" />;
}

const budgetRealityTooltipFormatter: TooltipProps<number, string>['formatter'] = (value) => {
  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
  return fmtUSD(Number.isFinite(numericValue) ? numericValue : 0);
};

function budgetRealityClassName(expenses: number, totalBudget: number) {
  return Number(expenses) > Number(totalBudget) ? uiTextRecipes.danger : uiTextRecipes.success;
}

function realityGradientStopPercent(expenses: number[], totalBudget: number): string {
  if (expenses.length === 0) {
    return '50';
  }
  const minExpenses = Math.min(...expenses);
  const maxExpenses = Math.max(...expenses);
  const range = maxExpenses - minExpenses;
  if (range <= 0) {
    return '50';
  }
  return (((Number(totalBudget) - minExpenses) / range) * 100).toFixed(2);
}

const BudgetVsActualChartFn: React.FC<BudgetVsActualChartProps> = ({
  data,
  totalBudget,
  width,
  height,
}) => {
  const { colors } = useTheme();
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const expenses = useMemo(
    () =>
      data
        .map((point) => Number(point.expenses))
        .filter((value) => Number.isFinite(value)),
    [data]
  );
  const zeroPercent = useMemo(
    () => realityGradientStopPercent(expenses, totalBudget),
    [expenses, totalBudget]
  );
  const gradientStroke = `url(#${gradientId})`;
  const expenseRange = useMemo(() => {
    if (expenses.length === 0) {
      return 0;
    }
    return Math.max(...expenses) - Math.min(...expenses);
  }, [expenses]);
  const lineStroke = useMemo(() => {
    if (expenseRange > 0) {
      return gradientStroke;
    }
    const lastExpense = expenses[expenses.length - 1];
    if (lastExpense == null) {
      return gradientStroke;
    }
    return realityMarkerColor(lastExpense, totalBudget, colors.semantic.cash, colors.semantic.credit);
  }, [colors.semantic.cash, colors.semantic.credit, expenseRange, expenses, gradientStroke, totalBudget]);

  const yDomain = useMemo(
    () => realityChartDomain(data.map((point) => Number(point.expenses)), Number(totalBudget)),
    [data, totalBudget]
  );

  return (
    <LineChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
      accessibilityLayer={false}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={colors.semantic.cash} />
          <stop offset={`${zeroPercent}%`} stopColor={colors.semantic.cash} />
          <stop offset={`${zeroPercent}%`} stopColor={colors.semantic.credit} />
          <stop offset="100%" stopColor={colors.semantic.credit} />
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
        domain={yDomain}
        allowDataOverflow={false}
        tick={{ fill: colors.chart.axis, fontSize: 12 }}
        axisLine={false}
        tickLine={false}
        tickCount={Math.min(7, Math.max(5, Math.floor(height / 50)))}
        tickFormatter={(v) => {
          const n = Math.abs(Number(v));
          if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}b`;
          if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}m`;
          if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
          return `$${Number(n).toFixed(0)}`;
        }}
      />
      <Tooltip
        cursor={false}
        content={(tooltipProps) => {
          const rawExpenses = tooltipProps.payload?.[0]?.value;
          const expenses =
            typeof rawExpenses === 'number' ? rawExpenses : Number(rawExpenses ?? Number.NaN);
          const realityClassName = Number.isFinite(expenses)
            ? budgetRealityClassName(expenses, totalBudget)
            : uiTextRecipes.primary;

          return (
            <ChartGlassTooltip
              {...tooltipProps}
              formatter={budgetRealityTooltipFormatter}
              valueClassNameForEntry={() => realityClassName}
              labelFormatter={(label, payload) => {
                const monthKey = String(
                  label ?? (payload?.[0]?.payload as { month?: string } | undefined)?.month ?? ''
                );
                if (!monthKey) return null;
                const monthLabel = formatChartMonthLabel(monthKey);
                return (
                  <>
                    <span className={cn('block', font.caption, uiTextRecipes.muted)}>
                      {monthLabel}
                    </span>
                    <span className={cn('block', font.caption, uiTextRecipes.body)}>
                      <span className={uiTextRecipes.muted}>Total budget: </span>
                      <span className={uiTextRecipes.primary}>{fmtUSD(totalBudget)}</span>
                    </span>
                  </>
                );
              }}
            />
          );
        }}
        {...chartTooltipRechartsProps}
      />
      <ReferenceLine
        y={totalBudget}
        stroke={colors.chart.axis}
        strokeDasharray="3 3"
        label={{
          value: 'Budget',
          position: 'insideTopRight',
          fill: colors.chart.axis,
          fontSize: 12,
        }}
      />
      <Line
        type="monotone"
        dataKey="expenses"
        stroke={gradientStroke}
        strokeWidth={2}
        shape={(curveProps: CurveProps) => (
          <BudgetRealityCurve curveProps={curveProps} stroke={lineStroke} />
        )}
        dot={(props) => {
          const point = props.payload as BudgetVsActualChartData | undefined;
          const cx = props.cx;
          const cy = props.cy;
          if (!point || cx == null || cy == null) {
            return null;
          }
          const fill = realityMarkerColor(
            point.expenses,
            totalBudget,
            colors.semantic.cash,
            colors.semantic.credit
          );
          return (
            <g>
              <circle cx={cx} cy={cy} r={10} fill="transparent" stroke="none" />
              <circle
                cx={cx}
                cy={cy}
                r={5}
                fill={fill}
                stroke={colors.chart.dotFill}
                strokeWidth={2}
              />
            </g>
          );
        }}
        activeDot={(props) => {
          const point = props.payload as BudgetVsActualChartData | undefined;
          const cx = props.cx;
          const cy = props.cy;
          if (!point || cx == null || cy == null) {
            return null;
          }
          const fill = realityMarkerColor(
            point.expenses,
            totalBudget,
            colors.semantic.cash,
            colors.semantic.credit
          );
          return (
            <circle
              cx={cx}
              cy={cy}
              r={7}
              fill={fill}
              stroke={colors.chart.dotFill}
              strokeWidth={2}
            />
          );
        }}
        isAnimationActive
        animationBegin={0}
        animationDuration={CHART_ANIMATION_MS}
        animateNewValues
        name="Reality"
      />
    </LineChart>
  );
};

export const BudgetVsActualChart = React.memo(BudgetVsActualChartFn);
