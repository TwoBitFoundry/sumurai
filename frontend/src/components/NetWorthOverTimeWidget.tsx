import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTheme } from '../context/ThemeContext';

export const NetWorthOverTimeWidget: React.FC = () => {
  const { colors } = useTheme();
  const mockData = [
    { date: '2024-01', netWorth: 10000 },
    { date: '2024-02', netWorth: 10500 },
    { date: '2024-03', netWorth: 11000 },
  ];

  return (
    <div data-testid="net-worth-widget" className="h-full">
      <div className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">Net Worth Over Time</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={mockData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="netWorth" stroke={colors.semantic.netWorth} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};