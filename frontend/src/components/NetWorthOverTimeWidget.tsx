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
import { cn } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import { useTheme } from '../context/ThemeContext';

export const NetWorthOverTimeWidget: React.FC = () => {
  const { colors } = useTheme();
  const mockData = [
    { date: '2024-01', netWorth: 10000 },
    { date: '2024-02', netWorth: 10500 },
    { date: '2024-03', netWorth: 11000 },
  ];

  return (
    <div data-testid="net-worth-widget" className={cn('h-full', 'w-full', 'min-w-0')}>
      <div className={cn(designTokens.typography.captionStrong, 'mb-4', designTokens.text.muted)}>
        Net Worth Over Time
      </div>
      <div className={cn('h-[200px]', 'w-full', 'min-w-0')}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={mockData}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.chart.grid} />
            <XAxis dataKey="date" tick={{ fill: colors.chart.axis }} />
            <YAxis tick={{ fill: colors.chart.axis }} />
            <Tooltip
              contentStyle={{
                background: colors.chart.tooltipBg,
                borderColor: colors.chart.tooltipBorder,
                color: colors.chart.tooltipText,
              }}
            />
            <Line type="monotone" dataKey="netWorth" stroke={colors.semantic.netWorth} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
