import { render } from '@testing-library/react';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { SpendingByCategoryChart } from '@/features/analytics/components/SpendingByCategoryChart';
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics';
import { useNetWorthSeries } from '@/features/analytics/hooks/useNetWorthSeries';
import { getThemeColors } from '@/ui/tokens';
import DashboardPage from '@/views/DashboardPage';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/features/analytics/hooks/useAnalytics', () => ({
  useAnalytics: jest.fn(),
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
      mode: 'light',
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
    const { unmount } = render(<DashboardPage dateRange="current-month" setDateRange={noop} />);

    expect(chartMock).toHaveBeenCalledTimes(1);
    expect(chartMock.mock.calls[0][0].animated).toBe(true);

    unmount();

    render(<DashboardPage dateRange="current-month" setDateRange={noop} />);

    expect(chartMock).toHaveBeenCalledTimes(2);
    expect(chartMock.mock.calls[1][0].animated).toBe(false);
  });
});
