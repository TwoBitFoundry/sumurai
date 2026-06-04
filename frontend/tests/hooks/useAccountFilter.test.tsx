import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { AccountFilterTestProvider } from '@tests/utils/AccountFilterTestProvider';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { ACCOUNTS_CHANGED_EVENT } from '@/utils/events';

type BroadcastChannelListener = (event: MessageEvent) => void;

interface MockBroadcastChannel {
  postMessage: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  close: jest.Mock;
  _listeners: BroadcastChannelListener[];
  _simulateMessage: (data: unknown) => void;
}

let mockChannelInstance: MockBroadcastChannel | null = null;

function makeMockChannel(): MockBroadcastChannel {
  const listeners: BroadcastChannelListener[] = [];
  const instance: MockBroadcastChannel = {
    postMessage: jest.fn(),
    addEventListener: jest.fn((_type: string, fn: BroadcastChannelListener) => {
      listeners.push(fn);
    }),
    removeEventListener: jest.fn((_type: string, fn: BroadcastChannelListener) => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    close: jest.fn(),
    _listeners: listeners,
    _simulateMessage(data: unknown) {
      listeners.forEach((fn) => {
        fn({ data } as MessageEvent);
      });
    },
  };
  return instance;
}

describe('AccountFilterProvider', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockChannelInstance = makeMockChannel();
    Object.defineProperty(window, 'BroadcastChannel', {
      value: jest.fn(() => mockChannelInstance),
      writable: true,
      configurable: true,
    });

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

    const plaidAccountsFixture = [
      {
        id: 'acc_1',
        name: 'Everyday Checking',
        account_type: 'depository',
        balance_current: 1250.5,
        mask: '0000',
        plaid_connection_id: 'conn_1',
        institution_name: 'First Platypus Bank',
        provider: 'plaid' as const,
        transaction_count: 42,
      },
      {
        id: 'acc_2',
        name: 'High-Yield Savings',
        account_type: 'depository',
        balance_current: 5000.0,
        mask: '1111',
        plaid_connection_id: 'conn_1',
        institution_name: 'First Platypus Bank',
        provider: 'plaid' as const,
        transaction_count: 18,
      },
      {
        id: 'acc_3',
        name: 'Rewards Credit Card',
        account_type: 'credit',
        balance_current: -350.75,
        mask: '2222',
        plaid_connection_id: 'conn_2',
        institution_name: 'Second Platypus Bank',
        provider: 'plaid' as const,
        transaction_count: 203,
      },
    ];

    fetchMock = installFetchRoutes({
      'GET /api/providers/accounts': plaidAccountsFixture,
      'GET /api/plaid/accounts': plaidAccountsFixture,
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
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.allAccountIds.sort()).toEqual(['acc_1', 'acc_2', 'acc_3']);
          expect(result.current.isAllAccountsSelected).toBe(true);
          expect(result.current.selectedAccountIds.sort()).toEqual(['acc_1', 'acc_2', 'acc_3']);
        });
      });

      it('Then it should keep a newly added institution selected after refresh', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.selectedAccountIds.sort()).toEqual(['acc_1', 'acc_2', 'acc_3']);
        });

        fetchMock.mockImplementationOnce(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();

          if (url.includes('/api/providers/accounts')) {
            return new Response(
              JSON.stringify([
                {
                  id: 'acc_1',
                  name: 'Everyday Checking',
                  account_type: 'depository',
                  balance_current: 1250.5,
                  mask: '0000',
                  plaid_connection_id: 'conn_1',
                  institution_name: 'First Platypus Bank',
                  provider: 'plaid',
                  transaction_count: 42,
                },
                {
                  id: 'acc_2',
                  name: 'High-Yield Savings',
                  account_type: 'depository',
                  balance_current: 5000.0,
                  mask: '1111',
                  plaid_connection_id: 'conn_1',
                  institution_name: 'First Platypus Bank',
                  provider: 'plaid',
                  transaction_count: 18,
                },
                {
                  id: 'acc_3',
                  name: 'Rewards Credit Card',
                  account_type: 'credit',
                  balance_current: -350.75,
                  mask: '2222',
                  plaid_connection_id: 'conn_2',
                  institution_name: 'Second Platypus Bank',
                  provider: 'plaid',
                  transaction_count: 203,
                },
                {
                  id: 'acc_4',
                  name: 'Premium Checking',
                  account_type: 'depository',
                  balance_current: 2750,
                  mask: '3333',
                  plaid_connection_id: 'conn_3',
                  institution_name: 'Third Platypus Bank',
                  provider: 'plaid',
                  transaction_count: 7,
                },
              ]),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });

        await act(async () => {
          window.dispatchEvent(new Event(ACCOUNTS_CHANGED_EVENT));
        });

        await waitFor(() => {
          expect(result.current.allAccountIds.sort()).toEqual(['acc_1', 'acc_2', 'acc_3', 'acc_4']);
        });

        expect(result.current.selectedAccountIds.sort()).toEqual([
          'acc_1',
          'acc_2',
          'acc_3',
          'acc_4',
        ]);
        expect(result.current.accountsByBank['Third Platypus Bank']).toHaveLength(1);
        expect(result.current.isAllAccountsSelected).toBe(true);
      });

      it('keeps SimpleFIN connections separate when they share the same institution label', async () => {
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();

          if (url.includes('/api/providers/accounts')) {
            return new Response(
              JSON.stringify([
                {
                  id: 'sf_acc_1',
                  name: 'Checking',
                  account_type: 'depository',
                  balance_current: 100,
                  mask: '1111',
                  provider_connection_id: 'sf_conn_1',
                  institution_name: 'SimpleFIN Bank',
                  provider: 'simplefin',
                  transaction_count: 3,
                },
                {
                  id: 'sf_acc_2',
                  name: 'Savings',
                  account_type: 'depository',
                  balance_current: 200,
                  mask: '2222',
                  provider_connection_id: 'sf_conn_2',
                  institution_name: 'SimpleFIN Bank',
                  provider: 'simplefin',
                  transaction_count: 5,
                },
              ]),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(Object.keys(result.current.accountsByBank).sort()).toEqual([
            'SimpleFIN Bank::sf_conn_1',
            'SimpleFIN Bank::sf_conn_2',
          ]);
        });

        expect(result.current.accountsByBank['SimpleFIN Bank::sf_conn_1']).toHaveLength(1);
        expect(result.current.accountsByBank['SimpleFIN Bank::sf_conn_2']).toHaveLength(1);
        expect(result.current.allAccountIds.sort()).toEqual(['sf_acc_1', 'sf_acc_2']);
      });

      it('Then it should fetch the accounts endpoint only once on mount', async () => {
        const pendingResponse = new Promise<Response>(() => {});
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url.includes('/api/providers/accounts')) {
            return pendingResponse;
          }

          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
        );

        renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(
            fetchMock.mock.calls.filter((call) =>
              String(call[0]).includes('/api/providers/accounts')
            ).length
          ).toBe(1);
        });
      });
    });

    describe('When checking current selection state', () => {
      it('Then it should expose current selection state', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
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
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('First Platypus Bank');
          expect(result.current.accountsByBank).toHaveProperty('Second Platypus Bank');
        });

        expect(result.current.accountsByBank['First Platypus Bank']).toHaveLength(2);
        expect(result.current.accountsByBank['Second Platypus Bank']).toHaveLength(1);
      });

      it('Then it should map transaction_count from unified providers accounts (Plaid route)', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.accountsByBank['First Platypus Bank']).toHaveLength(2);
        });

        const firstBank = result.current.accountsByBank['First Platypus Bank'];
        expect(firstBank?.[0]?.transaction_count).toBe(42);
        expect(firstBank?.[1]?.transaction_count).toBe(18);
        expect(result.current.accountsByBank['Second Platypus Bank']?.[0]?.transaction_count).toBe(
          203
        );
      });

      it('Then it should map balance_current from unified providers accounts', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.accountsByBank['First Platypus Bank']).toHaveLength(2);
        });

        const firstBank = result.current.accountsByBank['First Platypus Bank'];
        expect(firstBank?.[0]?.balance_current).toBe(1250.5);
        expect(firstBank?.[1]?.balance_current).toBe(5000);
      });

      it('Then it should support toggle bank action', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
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
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
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

      it('Then it should keep the last loaded accounts when refresh fails', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
        );

        const { result } = renderHook(() => useAccountFilter(), { wrapper });

        await waitFor(() => {
          expect(result.current.allAccountIds).toHaveLength(3);
        });

        fetchMock.mockImplementationOnce(async () => {
          throw new Error('offline');
        });

        await act(async () => {
          window.dispatchEvent(new Event(ACCOUNTS_CHANGED_EVENT));
        });

        await waitFor(() => {
          expect(result.current.allAccountIds).toHaveLength(3);
        });
        expect(result.current.selectedAccountIds.sort()).toEqual(['acc_1', 'acc_2', 'acc_3']);
        expect(
          fetchMock.mock.calls.filter((call) => String(call[0]).includes('/api/providers/accounts'))
            .length
        ).toBe(2);
      });
    });
  });

  describe('BroadcastChannel sync', () => {
    it('Then it should broadcast filter-changed when a user toggles an account', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
      );

      const { result } = renderHook(() => useAccountFilter(), { wrapper });

      await waitFor(() => {
        expect(result.current.allAccountIds).toHaveLength(3);
      });

      const channel = mockChannelInstance!;
      channel.postMessage.mockClear();

      act(() => {
        result.current.toggleAccount('acc_1');
      });

      expect(channel.postMessage).toHaveBeenCalledWith({
        type: 'filter-changed',
        selectedIds: expect.arrayContaining(['acc_2', 'acc_3']),
      });
      expect(channel.postMessage.mock.calls[0][0].selectedIds).toHaveLength(2);
    });

    it('Then it should not broadcast on initial default load', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
      );

      const { result } = renderHook(() => useAccountFilter(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAllAccountsSelected).toBe(true);
      });

      const filterChangedCalls = mockChannelInstance!.postMessage.mock.calls.filter(
        (call) => call[0]?.type === 'filter-changed'
      );
      expect(filterChangedCalls).toHaveLength(0);
    });

    it('Then it should apply filter-changed from another tab without echoing', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
      );

      const { result } = renderHook(() => useAccountFilter(), { wrapper });

      await waitFor(() => {
        expect(result.current.allAccountIds).toHaveLength(3);
      });

      const channel = mockChannelInstance!;
      channel.postMessage.mockClear();

      act(() => {
        channel._simulateMessage({ type: 'filter-changed', selectedIds: ['acc_1'] });
      });

      await waitFor(() => {
        expect(result.current.selectedAccountIds).toEqual(['acc_1']);
      });

      const filterChangedCalls = channel.postMessage.mock.calls.filter(
        (call) => call[0]?.type === 'filter-changed'
      );
      expect(filterChangedCalls).toHaveLength(0);
    });

    it('Then it should send filter-request on first load and apply filter-response', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AccountFilterTestProvider>{children}</AccountFilterTestProvider>
      );

      const { result } = renderHook(() => useAccountFilter(), { wrapper });

      await waitFor(() => {
        expect(result.current.allAccountIds).toHaveLength(3);
      });

      const channel = mockChannelInstance!;
      expect(channel.postMessage).toHaveBeenCalledWith({ type: 'filter-request' });

      act(() => {
        channel._simulateMessage({ type: 'filter-response', selectedIds: ['acc_2', 'acc_3'] });
      });

      await waitFor(() => {
        expect(result.current.selectedAccountIds.sort()).toEqual(['acc_2', 'acc_3']);
      });
    });
  });
});
