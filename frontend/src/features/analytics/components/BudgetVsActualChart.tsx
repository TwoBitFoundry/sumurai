import React, { useId, useMemo } from 'react';
import type { TooltipProps } from 'recharts';
import {
  CartesianGrid,
  Curve,
  type CurveProps,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';
import { fmtUSD } from '../../../utils/format';
import { varianceChartDomain } from '../utils/budgetChartAxis';
import { formatChartMonthLabel } from '../utils/chartMonth';
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

function varianceMarkerColor(variance: number, underColor: string, overColor: string) {
  return variance > 0 ? overColor : underColor;
}

const CHART_ANIMATION_MS = 800;

function BudgetVarianceCurve({ curveProps, stroke }: { curveProps: CurveProps; stroke: string }) {
  const { strokeDasharray: _strokeDasharray, ...curveWithoutDash } = curveProps;
  return <Curve {...curveWithoutDash} stroke={stroke} strokeWidth={2} fill="none" />;
}

const budgetTooltipFormatter: TooltipProps<number, string>['formatter'] = (value) => {
  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
  return fmtUSD(Number.isFinite(numericValue) ? numericValue : 0);
};

function varianceGradientStopPercent(varianceData: VarianceDataPoint[]): string {
  if (varianceData.length === 0) {
    return '50';
  }
  const minVariance = Math.min(...varianceData.map((p) => p.variance), 0);
  const maxVariance = Math.max(...varianceData.map((p) => p.variance), 0);
  const range = maxVariance - minVariance;
  if (range <= 0) {
    return '50';
  }
  return ((-minVariance / range) * 100).toFixed(2);
}

const BudgetVsActualChartFn: React.FC<BudgetVsActualChartProps> = ({
  data,
  totalBudget,
  width,
  height,
}) => {
  const { colors } = useTheme();
  const gradientId = useId().replace(/:/g, '');

  const varianceData = useMemo<VarianceDataPoint[]>(
    () =>
      data.map((point) => ({
        month: point.month,
        variance: point.expenses - totalBudget,
      })),
    [data, totalBudget]
  );

  const zeroPercent = varianceGradientStopPercent(varianceData);
  const gradientStroke = `url(#${gradientId})`;
  const varianceRange = useMemo(() => {
    if (varianceData.length === 0) {
      return 0;
    }
    const values = varianceData.map((point) => point.variance);
    return Math.max(...values) - Math.min(...values);
  }, [varianceData]);
  const lineStroke = useMemo(() => {
    if (varianceRange > 0) {
      return gradientStroke;
    }
    const last = varianceData[varianceData.length - 1];
    if (!last) {
      return gradientStroke;
    }
    return varianceMarkerColor(last.variance, colors.semantic.cash, colors.semantic.credit);
  }, [varianceRange, varianceData, gradientStroke, colors.semantic.cash, colors.semantic.credit]);
  const yDomain = useMemo(
    () => varianceChartDomain(varianceData.map((point) => point.variance)),
    [varianceData]
  );

  return (
    <LineChart
      width={width}
      height={height}
      data={varianceData}
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
            labelFormatter={(_label, payload) => {
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
          position: 'insideTopRight',
          fill: colors.chart.axis,
          fontSize: 12,
        }}
      />
      <Line
        type="monotone"
        dataKey="variance"
        stroke={gradientStroke}
        strokeWidth={2}
        dot={(props) => {
          const point = props.payload as VarianceDataPoint | undefined;
          const cx = props.cx;
          const cy = props.cy;
          if (!point || cx == null || cy == null) {
            return null;
          }
          const fill = varianceMarkerColor(
            point.variance,
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
          const point = props.payload as VarianceDataPoint | undefined;
          const cx = props.cx;
          const cy = props.cy;
          if (!point || cx == null || cy == null) {
            return null;
          }
          const fill = varianceMarkerColor(
            point.variance,
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
        name="Variance"
        shape={(curveProps: CurveProps) => (
          <BudgetVarianceCurve curveProps={curveProps} stroke={lineStroke} />
        )}
      />
    </LineChart>
  );
};

export const BudgetVsActualChart = React.memo(BudgetVsActualChartFn);
