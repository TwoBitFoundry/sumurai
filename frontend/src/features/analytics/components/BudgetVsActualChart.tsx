import type React from 'react';
import type { TooltipProps } from 'recharts';
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
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

interface VarianceDataPoint {
  month: string;
  variance: number;
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

  const varianceData: VarianceDataPoint[] = data.map((point) => ({
    month: point.month,
    variance: point.expenses - totalBudget,
  }));

  return (
    <LineChart
      width={width}
      height={height}
      data={varianceData}
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
        tickCount={Math.max(3, Math.floor(height / 70))}
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
            labelFormatter={(label, payload) => {
              if (!payload?.length) return null;
              const value = payload[0].value;
              if (typeof value !== 'number') return null;
              return value > 0
                ? `Over budget: ${fmtUSD(value)}`
                : `Under budget: ${fmtUSD(-value)}`;
            }}
          />
        )}
        {...chartTooltipRechartsProps}
      />
      <ReferenceLine
        y={0}
        stroke={colors.chart.axis}
        strokeDasharray="3 3"
        label={{
          value: 'On Budget',
          position: 'right',
          fill: colors.chart.axis,
          fontSize: 12,
          offset: 8,
        }}
      />
      <Line
        type="monotone"
        dataKey="variance"
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
        name="Variance"
        shape={
          <VarianceLineWithConditionalColor
            greenColor={colors.semantic.cash}
            redColor={colors.semantic.credit}
          />
        }
      />
    </LineChart>
  );
};

interface VarianceLineWithConditionalColorProps {
  greenColor: string;
  redColor: string;
  points?: Array<{ x: number; y: number; payload?: VarianceDataPoint }>;
  strokeWidth?: number;
}

const VarianceLineWithConditionalColor: React.FC<VarianceLineWithConditionalColorProps> = ({
  greenColor,
  redColor,
  points = [],
  strokeWidth = 2,
}) => {
  if (points.length < 2) return null;

  const pathSegments: React.JSX.Element[] = [];
  let segmentKey = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const currentVariance = current.payload?.variance ?? 0;
    const nextVariance = next.payload?.variance ?? 0;

    const currentIsNegative = currentVariance < 0;
    const nextIsNegative = nextVariance < 0;
    const crossesZero = currentIsNegative !== nextIsNegative;

    if (!crossesZero) {
      const stroke = currentIsNegative ? greenColor : redColor;
      const pathData = `M ${current.x} ${current.y} L ${next.x} ${next.y}`;

      pathSegments.push(
        <path
          key={`segment-${segmentKey}`}
          d={pathData}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      );
      segmentKey += 1;
    } else {
      const t = -currentVariance / (nextVariance - currentVariance);
      const crossX = current.x + (next.x - current.x) * t;
      const crossY = 0;

      const firstPathData = `M ${current.x} ${current.y} L ${crossX} ${crossY}`;
      const firstStroke = currentIsNegative ? greenColor : redColor;

      pathSegments.push(
        <path
          key={`segment-${segmentKey}`}
          d={firstPathData}
          stroke={firstStroke}
          strokeWidth={strokeWidth}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      );
      segmentKey += 1;

      const secondPathData = `M ${crossX} ${crossY} L ${next.x} ${next.y}`;
      const secondStroke = nextIsNegative ? greenColor : redColor;

      pathSegments.push(
        <path
          key={`segment-${segmentKey}`}
          d={secondPathData}
          stroke={secondStroke}
          strokeWidth={strokeWidth}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      );
      segmentKey += 1;
    }
  }

  return <g>{pathSegments}</g>;
};
