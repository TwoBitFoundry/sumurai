import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NetWorthOverTimeWidget } from './NetWorthOverTimeWidget';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('NetWorthOverTimeWidget', () => {
  it('renders without crashing', () => {
    render(<NetWorthOverTimeWidget dark={false} />);
    expect(screen.getByTestId('net-worth-widget')).toBeInTheDocument();
  });

  it('displays Net Worth Over Time heading and line chart structure', () => {
    render(<NetWorthOverTimeWidget dark={false} />);
    
    expect(screen.getByText('Net Worth Over Time')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
  });
});