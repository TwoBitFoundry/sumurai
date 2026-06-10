import { render, screen } from '@testing-library/react';
import { BalancesOverview } from '@/components/BalancesOverview';
import { useTheme } from '@/context/ThemeContext';
import { useCashFlow } from '@/features/analytics/hooks/useCashFlow';
import { useBalancesOverview } from '@/hooks/useBalancesOverview';
import { getThemeColors } from '@/ui/tokens';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/hooks/useBalancesOverview', () => ({
  useBalancesOverview: jest.fn(),
}));

jest.mock('@/features/analytics/hooks/useCashFlow', () => ({
  useCashFlow: jest.fn(),
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
  const year = new Date().getFullYear();

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

    jest.mocked(useCashFlow).mockReturnValue({
      series: [
        { month: `${year}-01`, income: 3000, expenses: 800, net: 2200 },
        { month: `${year}-02`, income: 2500, expenses: 600, net: 1900 },
        { month: `${year - 1}-12`, income: 2000, expenses: 500, net: 1500 },
      ],
      loading: false,
      refreshing: false,
      error: null,
      reload: jest.fn(),
    });
  });

  it('passes computed YTD totals to BalancesInsightsPanel', () => {
    render(<BalancesOverview />);

    expect(screen.getByTestId('balances-ytd-income')).toHaveTextContent('$5,500.00');
    expect(screen.getByTestId('balances-ytd-expenses')).toHaveTextContent('$1,400.00');
  });

  it('requests twelve months of cash flow data', () => {
    render(<BalancesOverview />);

    expect(useCashFlow).toHaveBeenCalledWith(12);
  });
});
