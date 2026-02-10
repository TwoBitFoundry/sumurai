import { render, screen, within, cleanup } from '@testing-library/react';
import { NetWorthOverTimeWidget } from '@/components/NetWorthOverTimeWidget';
import { ThemeTestProvider } from '@tests/utils/ThemeTestProvider';

// Mock recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('NetWorthOverTimeWidget', () => {
  // Localized cleanup to avoid cross-test DOM leakage
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <ThemeTestProvider>
        <NetWorthOverTimeWidget />
      </ThemeTestProvider>
    );
    expect(screen.getByTestId('net-worth-widget')).toBeInTheDocument();
  });

  it('displays Net Worth Over Time heading and line chart structure', () => {
    render(
      <ThemeTestProvider>
        <NetWorthOverTimeWidget />
      </ThemeTestProvider>
    );
    const widget = screen.getByTestId('net-worth-widget');
    expect(within(widget).getByText('Net Worth Over Time')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
  });
});
