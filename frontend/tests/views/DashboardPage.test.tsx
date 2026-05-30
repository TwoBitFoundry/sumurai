import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { SpendingByCategoryChart } from '@/features/analytics/components/SpendingByCategoryChart';
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics';
import { useCashFlow } from '@/features/analytics/hooks/useCashFlow';
import { useNetWorthSeries } from '@/features/analytics/hooks/useNetWorthSeries';
import { getThemeColors } from '@/ui/tokens';
import DashboardPage from '@/views/DashboardPage';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/features/analytics/hooks/useAnalytics', () => ({
  useAnalytics: jest.fn(),
}));

jest.mock('@/features/analytics/hooks/useCashFlow', () => ({
  useCashFlow: jest.fn(),
}));

jest.mock('@/features/analytics/hooks/useNetWorthSeries', () => ({
  useNetWorthSeries: jest.fn(),
}));

jest.mock('@/components/BalancesOverview', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'balances-overview' }),
}));

jest.mock('@/features/analytics/components/SpendingByCategoryChart', () => ({
  SpendingByCategoryChart: jest.fn(() =>
    React.createElement('div', { 'data-testid': 'spending-by-category-chart' })
  ),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.mocked(useTheme).mockReturnValue({
      preference: 'light',
      mode: 'light',
      setPreference: jest.fn(),
      setMode: jest.fn(),
      toggle: jest.fn(),
      colors: getThemeColors('light'),
    } as any);

    jest.mocked(useAnalytics).mockReturnValue({
      loading: false,
      refreshing: false,
      error: null,
      spendingTotal: 3147.52,
      categories: [{ name: 'Food', value: 10 }] as any,
      topMerchants: [{ name: 'Cafe', amount: 10, transactionCount: 1 }] as any,
      monthlyTotals: [] as any,
      cacheKey: 'all',
      start: '2026-05-01',
      end: '2026-05-31',
    });

    jest.mocked(useCashFlow).mockReturnValue({
      loading: false,
      refreshing: false,
      error: null,
      series: [
        { month: '2026-05', income: 5000, expenses: 3000, net: 2000 },
        { month: '2026-04', income: 5000, expenses: 3000, net: 2000 },
      ] as any,
      reload: jest.fn(),
    });

    jest.mocked(useNetWorthSeries).mockReturnValue({
      loading: false,
      refreshing: false,
      error: null,
      series: [{ date: '2026-05-01', value: 10 }] as any,
    } as any);
  });

  it('keeps the spending chart animation off on remount when the query key is unchanged', () => {
    const chartMock = jest.mocked(SpendingByCategoryChart);
    const noop = jest.fn();
    const { container, unmount } = render(
      <DashboardPage dateRange="current-month" setDateRange={noop} />
    );

    expect(chartMock).toHaveBeenCalledTimes(1);
    expect(chartMock.mock.calls[0][0].animated).toBe(true);
    expect(container.querySelector('[data-testid="dashboard-page"] .space-y-6')).toHaveClass(
      'md:space-y-8'
    );
    expect(
      container.querySelector(
        '[data-testid="dashboard-page"] .grid.grid-cols-1.gap-4.items-stretch'
      )
    ).toHaveClass('md:gap-6');

    unmount();

    render(<DashboardPage dateRange="current-month" setDateRange={noop} />);

    expect(chartMock).toHaveBeenCalledTimes(2);
    expect(chartMock.mock.calls[1][0].animated).toBe(false);
  });

  it('highlights a top category card when tapped the same way as the chart', async () => {
    const user = userEvent.setup();
    const noop = jest.fn();
    render(<DashboardPage dateRange="current-month" setDateRange={noop} />);

    const topCard = screen.getByText('Food').closest('button');
    expect(topCard).toBeTruthy();
    expect((topCard as HTMLButtonElement).style.borderColor).toBe('');

    await user.click(topCard as HTMLElement);

    expect((topCard as HTMLButtonElement).style.borderColor).toBe('#0ea5e9');
  });
});
