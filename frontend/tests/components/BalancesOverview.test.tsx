import { render, screen } from '@testing-library/react';
import { BalancesOverview, BalancesOverviewSummary } from '@/components/BalancesOverview';
import { useTheme } from '@/context/ThemeContext';
import { useYtdIncomeExpenses } from '@/features/analytics/hooks/useYtdIncomeExpenses';
import { useBalancesOverview } from '@/hooks/useBalancesOverview';
import { PageLayout } from '@/layouts/PageLayout';
import { getThemeColors } from '@/ui/tokens';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/hooks/useBalancesOverview', () => ({
  useBalancesOverview: jest.fn(),
}));

jest.mock('@/features/analytics/hooks/useYtdIncomeExpenses', () => ({
  useYtdIncomeExpenses: jest.fn(),
}));

jest.mock('@/features/analytics/hooks/useChartContainerSize', () => ({
  useChartContainerSize: () => ({ ref: { current: null }, width: 0, height: 0 }),
}));

jest.mock('@/features/analytics/hooks/useDebouncedChartRecalc', () => ({
  useDebouncedChartRecalc: <T,>(value: T) => value,
}));

const sampleOverall = {
  cash: 10000,
  credit: -500,
  loan: 0,
  investments: 2000,
  positivesTotal: 12000,
  negativesTotal: -500,
  net: 11500,
  ratio: null,
};

describe('BalancesOverview', () => {
  beforeEach(() => {
    jest.mocked(useTheme).mockReturnValue({
      preference: 'light',
      mode: 'light',
      setPreference: jest.fn(),
      setMode: jest.fn(),
      toggle: jest.fn(),
      colors: getThemeColors('light'),
    } as ReturnType<typeof useTheme>);

    jest.mocked(useBalancesOverview).mockReturnValue({
      loading: false,
      refreshing: false,
      error: null,
      data: {
        asOf: 'latest',
        overall: sampleOverall,
        banks: [],
        mixedCurrency: false,
      },
      refresh: jest.fn(),
    });

    jest.mocked(useYtdIncomeExpenses).mockReturnValue({
      incomeYtd: 5500,
      expensesYtd: 1400,
      loading: false,
      error: null,
    });
  });

  it('passes computed YTD totals to BalancesInsightsPanel', () => {
    render(<BalancesOverview />);

    expect(screen.getByTestId('balances-ytd-income')).toHaveTextContent('$5,500.00');
    expect(screen.getByTestId('balances-ytd-expenses')).toHaveTextContent('$1,400.00');
  });

  it('omits YTD totals while they are loading', () => {
    jest.mocked(useYtdIncomeExpenses).mockReturnValue({
      incomeYtd: 0,
      expensesYtd: 0,
      loading: true,
      error: null,
    });

    render(<BalancesOverview />);

    expect(screen.queryByTestId('balances-ytd-income')).not.toBeInTheDocument();
    expect(screen.queryByTestId('balances-ytd-expenses')).not.toBeInTheDocument();
  });
});

describe('BalancesOverviewSummary', () => {
  beforeEach(() => {
    jest.mocked(useBalancesOverview).mockReturnValue({
      loading: false,
      refreshing: false,
      error: null,
      data: {
        asOf: 'latest',
        overall: sampleOverall,
        banks: [],
        mixedCurrency: false,
      },
      refresh: jest.fn(),
    });

    jest.mocked(useYtdIncomeExpenses).mockReturnValue({
      incomeYtd: 5500,
      expensesYtd: 1400,
      loading: false,
      error: null,
    });
  });

  it('renders BalancesInsightsPanel directly for sticky hero placement', () => {
    render(
      <PageLayout title="Dashboard" stats={<BalancesOverviewSummary />}>
        <div data-testid="page-content">Charts</div>
      </PageLayout>
    );

    const stickyScope = screen.getByTestId('page-layout-sticky-scope');
    const statsHost = stickyScope.querySelector('[data-page-layout-stats-host]');
    const shell = screen.getByTestId('balances-insights-shell');

    expect(statsHost).toContainElement(shell);
    expect(stickyScope.contains(shell)).toBe(true);
    expect(shell).toHaveClass('sticky');
  });
});
