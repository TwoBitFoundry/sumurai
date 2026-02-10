import { renderHook, cleanup, act, waitFor } from '@testing-library/react';
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures';

describe('AccountFilterProvider', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    const providerStatus = createProviderStatus({
      connections: [
        createProviderConnection({
          is_connected: true,
          connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
          account_count: 3,
        }),
      ],
    });

    fetchMock = installFetchRoutes({
      'GET /api/plaid/accounts': [
        {
          id: 'acc_1',
          name: 'Everyday Checking',
          account_type: 'depository',
          balance_current: 1250.5,
          mask: '0000',
          plaid_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
        },
        {
          id: 'acc_2',
          name: 'High-Yield Savings',
          account_type: 'depository',
          balance_current: 5000.0,
          mask: '1111',
          plaid_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
        },
        {
          id: 'acc_3',
          name: 'Rewards Credit Card',
          account_type: 'credit',
          balance_current: -350.75,
          mask: '2222',
          plaid_connection_id: 'conn_2',
          institution_name: 'Second Platypus Bank',
        },
      ],
      'GET /api/providers/status': providerStatus,
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Given the provider is initialized', () => {
    describe('When no custom selection is made', () => {
      it('Then it should default to all accounts selected', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.allAccountIds.sort()).toEqual(['acc_1', 'acc_2', 'acc_3']);
        });

        expect(result.current.isAllAccountsSelected).toBe(true);
        expect(result.current.selectedAccountIds.sort()).toEqual(['acc_1', 'acc_2', 'acc_3']);
      });
    });

    describe('When checking current selection state', () => {
      it('Then it should expose current selection state', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.allAccountIds).toHaveLength(3);
        });

        expect(result.current.isAllAccountsSelected).toBeDefined();
        expect(result.current.selectedAccountIds).toBeDefined();
        expect(Array.isArray(result.current.allAccountIds)).toBe(true);
        expect(Array.isArray(result.current.selectedAccountIds)).toBe(true);
      });
    });

    describe('When account metadata is available', () => {
      it('Then it should expose grouped account metadata by bank', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('First Platypus Bank');
          expect(result.current.accountsByBank).toHaveProperty('Second Platypus Bank');
        });

        expect(result.current.accountsByBank['First Platypus Bank']).toHaveLength(2);
        expect(result.current.accountsByBank['Second Platypus Bank']).toHaveLength(1);
      });

      it('Then it should support toggle bank action', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('First Platypus Bank');
        });

        act(() => {
          result.current.toggleBank('First Platypus Bank');
        });

        expect(result.current.isAllAccountsSelected).toBe(false);
        expect(result.current.selectedAccountIds.sort()).toEqual(['acc_3']);

        act(() => {
          result.current.toggleBank('Second Platypus Bank');
        });

        expect(result.current.selectedAccountIds).toEqual([]);

        act(() => {
          result.current.toggleBank('First Platypus Bank');
          result.current.toggleBank('Second Platypus Bank');
        });

        expect(result.current.selectedAccountIds.sort()).toEqual(['acc_1', 'acc_2', 'acc_3']);
        expect(result.current.isAllAccountsSelected).toBe(true);
      });

      it('Then it should support toggle individual account action', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('First Platypus Bank');
        });

        act(() => {
          result.current.toggleAccount('acc_1');
        });

        expect(result.current.isAllAccountsSelected).toBe(false);
        expect(result.current.selectedAccountIds.sort()).toEqual(['acc_2', 'acc_3']);

        act(() => {
          result.current.toggleAccount('acc_1');
        });

        expect(result.current.selectedAccountIds.sort()).toEqual(['acc_1', 'acc_2', 'acc_3']);
        expect(result.current.isAllAccountsSelected).toBe(true);
      });
    });
  });
});
