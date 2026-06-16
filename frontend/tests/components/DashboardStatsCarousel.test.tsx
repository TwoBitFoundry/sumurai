import { render, screen } from '@testing-library/react';
import React from 'react';
import { DashboardStatsCarousel } from '@/components/DashboardStatsCarousel';

jest.mock('@/features/analytics/components/MoneyFlowSankeyChart', () => ({
  __esModule: true,
  MoneyFlowSankeyChart: () =>
    React.createElement('div', { 'data-testid': 'money-flow-sankey-chart' }),
  default: () => React.createElement('div', { 'data-testid': 'money-flow-sankey-chart' }),
}));

describe('DashboardStatsCarousel', () => {
  it('renders the money flow chart without balance tabs', () => {
    render(<DashboardStatsCarousel dateRange="current-month" />);

    expect(screen.getByTestId('dashboard-stats-carousel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /financial breakdown/i })).toBeInTheDocument();
    expect(
      screen.getByText('Follow income and spending across your accounts.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('money-flow-sankey-chart')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByTestId('balances-chart')).not.toBeInTheDocument();
  });
});
