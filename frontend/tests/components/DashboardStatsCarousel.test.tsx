import { render, screen } from '@testing-library/react';
import React from 'react';
import { DashboardStatsCarousel } from '@/components/DashboardStatsCarousel';
import { MoneyFlowSankeyChart } from '@/features/analytics/components/MoneyFlowSankeyChart';
import { useChartContainerSize } from '@/features/analytics/hooks/useChartContainerSize';

jest.mock('@/features/analytics/components/MoneyFlowSankeyChart', () => ({
  __esModule: true,
  MoneyFlowSankeyChart: jest.fn(() =>
    React.createElement('div', { 'data-testid': 'money-flow-sankey-chart' })
  ),
  default: jest.fn(() => React.createElement('div', { 'data-testid': 'money-flow-sankey-chart' })),
}));

jest.mock('@/features/analytics/hooks/useChartContainerSize', () => ({
  useChartContainerSize: jest.fn(),
}));

describe('DashboardStatsCarousel', () => {
  beforeEach(() => {
    jest.mocked(useChartContainerSize).mockReturnValue({
      ref: jest.fn(),
      width: 640,
      height: 920,
      remeasure: jest.fn(),
    });
  });

  it('renders the money flow chart without balance tabs', () => {
    render(<DashboardStatsCarousel dateRange="current-month" />);

    expect(screen.getByTestId('dashboard-stats-carousel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /financial breakdown/i })).toBeInTheDocument();
    expect(
      screen.queryByText('Follow income and spending across your accounts.')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('money-flow-sankey-chart')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByTestId('balances-chart')).not.toBeInTheDocument();
    expect(jest.mocked(MoneyFlowSankeyChart)).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRange: 'current-month',
        containerSize: { width: 640 },
      }),
      undefined
    );
  });
});
