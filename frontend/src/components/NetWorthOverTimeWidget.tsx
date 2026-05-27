import type React from 'react';
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
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { chart, getThemeColors } from '@/ui/tokens';
import { useTheme } from '../context/ThemeContext';

export const NetWorthOverTimeWidget: React.FC = () => {
  const { mode } = useTheme();
  const colors = getThemeColors(mode);
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
            <Line type="monotone" dataKey="netWorth" stroke={colors.semantic.netWorth} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
