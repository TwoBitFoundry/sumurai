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

function mockMatchMedia(matchesMdUp: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 768px') ? matchesMdUp : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe('DashboardStatsCarousel', () => {
  it('renders the insights card and navigates between money flow and balances', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    render(<DashboardStatsCarousel dateRange="current-month" />);

    expect(screen.getByTestId('dashboard-stats-carousel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /financial breakdown/i })).toBeInTheDocument();
    expect(
      screen.getByText('Follow income and spending across your accounts.')
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

    expect(
      screen.getByText('Review cash, credit, and loan balances across connected accounts.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Follow income and spending across your accounts.')
    ).not.toBeInTheDocument();
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
    mockMatchMedia(true);
    const user = userEvent.setup();
    render(<DashboardStatsCarousel dateRange="current-month" />);

    await user.click(screen.getByRole('tab', { name: /show balances now/i }));
    expect(screen.getByTestId('money-flow-sankey-chart')).toBeInTheDocument();
    expect(screen.getByTestId('balances-chart')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /show money flow/i }));
    expect(screen.getByTestId('money-flow-sankey-chart')).toBeInTheDocument();
    expect(screen.getByTestId('balances-chart')).toBeInTheDocument();
  });

  it('shows the balances subtitle on mobile where only balances are visible', () => {
    mockMatchMedia(false);
    render(<DashboardStatsCarousel dateRange="current-month" />);

    expect(
      screen.getByText('Review cash, credit, and loan balances across connected accounts.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Follow income and spending across your accounts.')
    ).not.toBeInTheDocument();
  });
});
