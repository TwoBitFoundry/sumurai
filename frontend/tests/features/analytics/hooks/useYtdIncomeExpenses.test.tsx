import { act, renderHook, waitFor } from '@testing-library/react';
import { AccountFilterTestProvider } from '@tests/utils/AccountFilterTestProvider';
import { useYtdIncomeExpenses } from '@/features/analytics/hooks/useYtdIncomeExpenses';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { AnalyticsService } from '@/services/AnalyticsService';
import { PlaidService } from '@/services/PlaidService';
import { ProviderCatalog } from '@/services/ProviderCatalog';

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    getIncomeExpenseTotals: jest.fn(),
  },
}));

jest.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getAccounts: jest.fn(),
    getStatus: jest.fn(),
  },
}));

jest.mock('@/services/ProviderCatalog', () => ({
  ProviderCatalog: {
    getAccounts: jest.fn(),
  },
}));

const TestWrapper = AccountFilterTestProvider;

const mockPlaidAccounts = [
  {
    id: 'account1',
    name: 'Mock Checking',
    account_type: 'depository',
    balance_current: 1200,
    mask: '1111',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank',
  },
  {
    id: 'account2',
    name: 'Mock Savings',
    account_type: 'depository',
    balance_current: 5400,
    mask: '2222',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank',
  },
];

describe('useYtdIncomeExpenses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AnalyticsService.getIncomeExpenseTotals).mockResolvedValue({
      income: 5250,
      expenses: 450,
    });
    jest.mocked(PlaidService.getStatus).mockResolvedValue({
      is_connected: true,
      institution_name: 'First Platypus Bank',
      connection_id: 'conn_1',
    } as any);
    jest.mocked(PlaidService.getAccounts).mockResolvedValue(mockPlaidAccounts as any);
    jest.mocked(ProviderCatalog.getAccounts).mockResolvedValue(mockPlaidAccounts as any);
  });

  it('loads the server totals for the computed YTD range', async () => {
    const year = new Date().getFullYear();
    const today = new Date().toISOString().slice(0, 10);

    const { result } = renderHook(
      () => {
        const filter = useAccountFilter();
        return { filter, ytd: useYtdIncomeExpenses() };
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.filter.allAccountIds).toEqual(['account1', 'account2']);
    });

    await waitFor(() => {
      expect(result.current.ytd.loading).toBe(false);
    });

    expect(AnalyticsService.getIncomeExpenseTotals).toHaveBeenCalledWith(
      `${year}-01-01`,
      today,
      undefined
    );
    expect(result.current.ytd).toMatchObject({
      incomeYtd: 5250,
      expensesYtd: 450,
      error: null,
    });
  });

  it('returns zeros without calling the service when no accounts are selected', async () => {
    const { result } = renderHook(
      () => {
        const filter = useAccountFilter();
        return { filter, ytd: useYtdIncomeExpenses() };
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.ytd.loading).toBe(false);
    });

    const callsBefore = jest.mocked(AnalyticsService.getIncomeExpenseTotals).mock.calls.length;

    await act(async () => {
      result.current.filter.setSelectedAccountIds([]);
    });

    await waitFor(() => {
      expect(result.current.ytd.incomeYtd).toBe(0);
      expect(result.current.ytd.expensesYtd).toBe(0);
    });

    expect(jest.mocked(AnalyticsService.getIncomeExpenseTotals).mock.calls.length).toBe(
      callsBefore
    );
  });
});
