import type React from 'react';
import { useId } from 'react';
import type { CurveProps } from 'recharts';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartGlassTooltip,
  chartTooltipRechartsProps,
} from '@/features/analytics/components/ChartGlassTooltip';
import {
  NetWorthGlowLineCurve,
  NetWorthLineGlowFilter,
  netWorthLineGlowFilterId,
} from '@/features/analytics/components/NetWorthGlowLineCurve';
import { cn } from '@/ui/primitives';
import {
  netWorthLineChart,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { chart } from '@/ui/tokens';
import { useTheme } from '../context/ThemeContext';

export const NetWorthOverTimeWidget: React.FC = () => {
  const { mode } = useTheme();
  const glowFilterId = netWorthLineGlowFilterId(useId().replace(/[^a-zA-Z0-9_-]/g, ''));
  const netWorthStroke = netWorthLineChart.stroke[mode];
  const mockData = [
    { date: '2024-01', netWorth: 10000 },
    { date: '2024-02', netWorth: 10500 },
    { date: '2024-03', netWorth: 11000 },
  ];

  return (
    <div data-testid="net-worth-widget" className={cn('h-full', 'w-full', 'min-w-0')}>
      <div className={cn(uiTypographyRecipes.captionStrong, 'mb-4', uiTextRecipes.muted)}>
        Net Worth Over Time
      </div>
      <div className={cn('h-[200px]', 'w-full', 'min-w-0')}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart accessibilityLayer={false} data={mockData}>
            <defs>
              <NetWorthLineGlowFilter filterId={glowFilterId} />
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid[mode]} />
            <XAxis dataKey="date" tick={{ fill: chart.axis[mode] }} />
            <YAxis tick={{ fill: chart.axis[mode] }} />
            <Tooltip
              cursor={false}
              content={(tooltipProps) => (
                <ChartGlassTooltip {...tooltipProps} valueClassName={uiTextRecipes.success} />
              )}
              {...chartTooltipRechartsProps}
            />
            <Line
              type="monotone"
              dataKey="netWorth"
              stroke={netWorthStroke}
              strokeWidth={2}
              dot={false}
              shape={(curveProps: CurveProps) => (
                <NetWorthGlowLineCurve
                  curveProps={curveProps}
                  stroke={netWorthStroke}
                  filterId={glowFilterId}
                />
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
