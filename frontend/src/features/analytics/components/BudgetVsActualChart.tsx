import type React from 'react';
import type { TooltipProps } from 'recharts';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';
import { fmtUSD } from '../../../utils/format';
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

const budgetTooltipFormatter: TooltipProps<number, string>['formatter'] = (value) => {
  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
  return fmtUSD(Number.isFinite(numericValue) ? numericValue : 0);
};

export const BudgetVsActualChart: React.FC<BudgetVsActualChartProps> = ({
  data,
  totalBudget,
  width,
  height,
}) => {
  const { colors } = useTheme();

  return (
    <BarChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      accessibilityLayer={false}
    >
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
            formatter={budgetTooltipFormatter}
            valueClassName="text-muted"
          />
        )}
        {...chartTooltipRechartsProps}
      />
      <ReferenceLine
        y={totalBudget}
        stroke={colors.chart.axis}
        strokeDasharray="4 4"
        label={{
          value: `Budget ${fmtUSD(totalBudget)}`,
          position: 'right',
          fill: colors.chart.axis,
          fontSize: 12,
          offset: 8,
        }}
      />
      <Bar
        dataKey="expenses"
        fill={colors.semantic.cash}
        name="Expenses"
        radius={[4, 4, 0, 0]}
        isAnimationActive={false}
        shape={
          <BarWithConditionalColor
            totalBudget={totalBudget}
            greenColor={colors.semantic.cash}
            roseColor={colors.semantic.credit}
          />
        }
      />
    </BarChart>
  );
};

interface BarWithConditionalColorProps {
  totalBudget: number;
  greenColor: string;
  roseColor: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { expenses: number };
}

const BarWithConditionalColor: React.FC<BarWithConditionalColorProps> = ({
  totalBudget,
  greenColor,
  roseColor,
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
}) => {
  const isOver = (payload?.expenses ?? 0) > totalBudget;
  const fill = isOver ? roseColor : greenColor;

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      rx={4}
      ry={4}
      style={{ transition: 'fill 0.2s ease-in-out' }}
    />
  );
};
