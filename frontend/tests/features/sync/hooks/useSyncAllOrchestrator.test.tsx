import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { BankConnectionViewModel } from '@/features/plaid/components/ConnectionsList';
import { useSyncAllOrchestrator } from '@/features/sync/hooks/useSyncAllOrchestrator';
import { RateLimitError } from '@/services/ApiClient';
import { PlaidService } from '@/services/PlaidService';
import { SimpleFinService } from '@/services/SimpleFinService';
import { TellerService } from '@/services/TellerService';
import { refreshFinancialDataAfterProviderChange } from '@/utils/queryInvalidation';

jest.mock('@/services/PlaidService', () => ({
  PlaidService: {
    syncTransactions: jest.fn(),
  },
}));

jest.mock('@/services/SimpleFinService', () => ({
  SimpleFinService: {
    syncBridge: jest.fn(),
  },
}));

jest.mock('@/services/TellerService', () => ({
  TellerService: {
    syncTransactions: jest.fn(),
  },
}));

jest.mock('@/utils/queryInvalidation', () => ({
  refreshFinancialDataAfterProviderChange: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/utils/formatUserFacingApiError', () => ({
  formatUserFacingApiError: jest.fn((_error: unknown, fallback: string) => fallback),
}));

const plaidSyncTransactions = jest.mocked(PlaidService.syncTransactions);
const simpleFinSyncBridge = jest.mocked(SimpleFinService.syncBridge);
const tellerSyncTransactions = jest.mocked(TellerService.syncTransactions);
const refreshAfterProviderChange = jest.mocked(refreshFinancialDataAfterProviderChange);

const makeBank = (
  id: string,
  provider: 'plaid' | 'teller' | 'simplefin',
  connectionId: string,
  accounts: BankConnectionViewModel['accounts'] = []
): BankConnectionViewModel => ({
  id,
  name: `${provider}-${id}`,
  short: id.slice(0, 2).toUpperCase(),
  status: 'connected',
  lastSync: null,
  provider,
  connectionId,
  accounts,
});

describe('useSyncAllOrchestrator', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  it('maps a SimpleFIN bridge response onto modal rows with a single request', async () => {
    simpleFinSyncBridge.mockResolvedValue({
      rateLimited: false,
      transactions: [
        { provider_account_id: 'acct-1' },
        { provider_account_id: 'acct-1' },
        { provider_account_id: 'acct-2' },
        { provider_account_id: 'acct-2' },
      ],
      simplefin_institution_results: [
        {
          institution_name: 'SimpleFIN Alpha',
          org_conn_id: 'conn-1',
          status: 'synced',
          transaction_count: 4,
          message: 'Synced 4 transactions',
        },
        {
          institution_name: 'SimpleFIN Beta',
          org_conn_id: 'conn-2',
          status: 'auth_required',
          message: 'Auth required',
        },
      ],
      bridge_warnings: [],
    } as any);

    const { result } = renderHook(
      () =>
        useSyncAllOrchestrator({
          banks: [
            makeBank('bank-1', 'simplefin', 'conn-1', [
              {
                id: 'acct-1',
                name: 'Checking',
                mask: '1234',
                type: 'checking',
                providerAccountId: 'acct-1',
              },
            ]),
            makeBank('bank-2', 'simplefin', 'conn-2', [
              {
                id: 'acct-2',
                name: 'Savings',
                mask: '5678',
                type: 'savings',
                providerAccountId: 'acct-2',
              },
            ]),
          ],
          primaryProvider: 'simplefin',
          isOnline: true,
          queryClient,
          onError: jest.fn(),
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.syncAll();
    });

    await waitFor(() => {
      expect(result.current.syncAllRows).toHaveLength(2);
    });

    expect(simpleFinSyncBridge).toHaveBeenCalledTimes(1);
    expect(simpleFinSyncBridge).toHaveBeenCalledWith('conn-1');
    expect(result.current.syncAllModalOpen).toBe(true);
    expect(result.current.syncAllRows[0]).toMatchObject({
      status: 'synced',
      transactionCount: 2,
    });
    expect(result.current.syncAllRows[1]).toMatchObject({
      status: 'auth_required',
      detail: 'Auth required',
    });
    expect(refreshAfterProviderChange).toHaveBeenCalledWith(queryClient, ['simplefin']);
  });

  it('matches SimpleFIN rows by connection id when institution names differ', async () => {
    simpleFinSyncBridge.mockResolvedValue({
      rateLimited: false,
      transactions: [{ provider_account_id: 'acct-1' }],
      simplefin_institution_results: [
        {
          institution_name: 'Bridge Label',
          org_conn_id: 'org-1',
          connection_id: 'conn-1',
          status: 'synced',
          transaction_count: 1,
          message: 'Synced 1 transaction',
        },
      ],
      bridge_warnings: [],
    } as any);

    const { result } = renderHook(
      () =>
        useSyncAllOrchestrator({
          banks: [
            makeBank('bank-1', 'simplefin', 'conn-1', [
              {
                id: 'acct-1',
                name: 'Checking',
                mask: '1234',
                type: 'checking',
                providerAccountId: 'acct-1',
              },
            ]),
          ],
          primaryProvider: 'simplefin',
          isOnline: true,
          queryClient,
          onError: jest.fn(),
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.syncAll();
    });

    await waitFor(() => {
      expect(result.current.syncAllRows[0].status).toBe('synced');
    });

    expect(result.current.syncAllRows[0]).toMatchObject({
      status: 'synced',
      transactionCount: 1,
    });
  });

  it('marks every SimpleFIN row rate-limited when the bridge returns 429', async () => {
    simpleFinSyncBridge.mockResolvedValue({
      rateLimited: true,
      retryAfterSeconds: 3600,
      transactions: [],
      simplefin_institution_results: [],
      bridge_warnings: [],
    });

    const { result } = renderHook(
      () =>
        useSyncAllOrchestrator({
          banks: [
            makeBank('bank-1', 'simplefin', 'conn-1'),
            makeBank('bank-2', 'simplefin', 'conn-2'),
          ],
          primaryProvider: 'simplefin',
          isOnline: true,
          queryClient,
          onError: jest.fn(),
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.syncAll();
    });

    expect(simpleFinSyncBridge).toHaveBeenCalledTimes(1);
    expect(result.current.syncAllRows).toMatchObject([
      { status: 'rate_limited', retryAfterSeconds: 3600 },
      { status: 'rate_limited', retryAfterSeconds: 3600 },
    ]);
    expect(refreshAfterProviderChange).not.toHaveBeenCalled();
  });

  it('stops a mixed Plaid batch after a mid-batch rate limit', async () => {
    const onError = jest.fn();
    plaidSyncTransactions
      .mockResolvedValueOnce({
        transactions: [{}, {}, {}],
        metadata: { transaction_count: 3 },
      } as any)
      .mockRejectedValueOnce(new RateLimitError('Too many requests', 7200));

    const { result } = renderHook(
      () =>
        useSyncAllOrchestrator({
          banks: [makeBank('bank-1', 'plaid', 'conn-1'), makeBank('bank-2', 'plaid', 'conn-2')],
          primaryProvider: 'plaid',
          isOnline: true,
          queryClient,
          onError,
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.syncAll();
    });

    await waitFor(() => {
      expect(result.current.syncAllRows[0].status).toBe('synced');
    });

    expect(plaidSyncTransactions).toHaveBeenCalledTimes(2);
    expect(plaidSyncTransactions).toHaveBeenNthCalledWith(1, 'conn-1');
    expect(plaidSyncTransactions).toHaveBeenNthCalledWith(2, 'conn-2');
    expect(result.current.syncAllRows).toMatchObject([
      {
        status: 'synced',
        transactionCount: 3,
      },
      {
        status: 'rate_limited',
        retryAfterSeconds: 7200,
      },
    ]);
    expect(onError).not.toHaveBeenCalled();
    expect(refreshAfterProviderChange).toHaveBeenCalledTimes(1);
  });

  it('syncs Teller banks sequentially and closes the modal after success', async () => {
    jest.useFakeTimers();
    tellerSyncTransactions.mockResolvedValue({ transactions: [] } as any);

    const { result } = renderHook(
      () =>
        useSyncAllOrchestrator({
          banks: [makeBank('bank-1', 'teller', 'conn-1'), makeBank('bank-2', 'teller', 'conn-2')],
          primaryProvider: 'teller',
          isOnline: true,
          queryClient,
          onError: jest.fn(),
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.syncAll();
    });

    expect(tellerSyncTransactions).toHaveBeenCalledTimes(2);
    expect(tellerSyncTransactions).toHaveBeenNthCalledWith(1, 'conn-1');
    expect(tellerSyncTransactions).toHaveBeenNthCalledWith(2, 'conn-2');
    expect(result.current.syncAllRows).toMatchObject([{ status: 'synced' }, { status: 'synced' }]);
    expect(result.current.syncAllModalOpen).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(result.current.syncAllModalOpen).toBe(false);
    });

    jest.useRealTimers();
  });
});
