import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DashboardStatsCarousel } from '@/components/DashboardStatsCarousel';

jest.mock('@/components/BalancesOverview', () => ({
  __esModule: true,
  BalancesOverviewChart: () => React.createElement('div', { 'data-testid': 'balances-chart' }),
  default: () => React.createElement('div', { 'data-testid': 'balances-full' }),
}));

jest.mock('@/features/analytics/components/MoneyFlowSankeyChart', () => ({
  __esModule: true,
  MoneyFlowSankeyChart: () =>
    React.createElement('div', { 'data-testid': 'money-flow-sankey-chart' }),
  default: () => React.createElement('div', { 'data-testid': 'money-flow-sankey-chart' }),
}));

describe('DashboardStatsCarousel', () => {
  it('renders the insights card and navigates between money flow and balances', async () => {
    const user = userEvent.setup();
    render(<DashboardStatsCarousel dateRange="current-month" />);

    expect(screen.getByTestId('dashboard-stats-carousel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /financial breakdown/i })).toBeInTheDocument();
    expect(
      screen.getByText('Switch between wealth flow and balances by account.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('money-flow-sankey-chart')).toBeInTheDocument();
    expect(screen.getByTestId('balances-chart')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /show money flow/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: /show balances now/i })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(document.getElementById('money-flow-panel')).not.toHaveAttribute('aria-hidden', 'true');
    expect(document.getElementById('balance-overview-panel')).toHaveAttribute(
      'aria-hidden',
      'true'
    );

    await user.click(screen.getByRole('tab', { name: /show balances now/i }));

    expect(screen.getByRole('tab', { name: /show balances now/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: /show money flow/i })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(document.getElementById('money-flow-panel')).toHaveAttribute('aria-hidden', 'true');
    expect(document.getElementById('balance-overview-panel')).not.toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  it('keeps both panels mounted while toggling visibility', async () => {
    const user = userEvent.setup();
    render(<DashboardStatsCarousel dateRange="current-month" />);

    await user.click(screen.getByRole('tab', { name: /show balances now/i }));
    expect(screen.getByTestId('money-flow-sankey-chart')).toBeInTheDocument();
    expect(screen.getByTestId('balances-chart')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /show money flow/i }));
    expect(screen.getByTestId('money-flow-sankey-chart')).toBeInTheDocument();
    expect(screen.getByTestId('balances-chart')).toBeInTheDocument();
  });
});
