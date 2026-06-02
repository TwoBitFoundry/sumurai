import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useSimpleFinFlow } from '@/features/simplefin/hooks/useSimpleFinFlow';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

jest.mock('@/services/SimpleFinService', () => ({
  SimpleFinService: {
    connectAndSyncAll: jest.fn(),
    getStatus: jest.fn(),
    syncTransactions: jest.fn(),
    syncBridge: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('@/utils/queryInvalidation', () => ({
  refreshFinancialDataAfterProviderChange: jest.fn().mockResolvedValue(undefined),
}));

const simpleFinServiceMock = jest.requireMock('@/services/SimpleFinService')
  .SimpleFinService as Record<string, jest.Mock>;

describe('useSimpleFinFlow', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
    simpleFinServiceMock.getStatus.mockResolvedValue([]);
    simpleFinServiceMock.syncTransactions.mockResolvedValue({ transactions: [], metadata: {} });
    simpleFinServiceMock.syncBridge.mockResolvedValue({
      rateLimited: false,
      transactions: [],
      simplefin_institution_results: [],
      bridge_warnings: [],
    });
  });

  it('connect calls service then syncs connections and repopulates state', async () => {
    simpleFinServiceMock.connectAndSyncAll.mockResolvedValue({
      rateLimited: false,
      transactionCount: 0,
      institutionsRequiringAuth: [],
    });
    simpleFinServiceMock.getStatus.mockResolvedValueOnce([]).mockResolvedValue([
      {
        is_connected: true,
        last_sync_at: null,
        institution_name: 'Bank A',
        connection_id: 'conn-1',
        transaction_count: 0,
        account_count: 1,
        sync_in_progress: false,
      },
      {
        is_connected: true,
        last_sync_at: null,
        institution_name: 'Bank B',
        connection_id: 'conn-2',
        transaction_count: 0,
        account_count: 1,
        sync_in_progress: false,
      },
    ]);

    const { result } = renderHook(() => useSimpleFinFlow({ enabled: true, isOnline: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(simpleFinServiceMock.connectAndSyncAll).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(2);
    });
    expect(result.current.error).toBeNull();
  });

  it('shows auth toast when connect succeeds with institutions requiring re-authentication', async () => {
    simpleFinServiceMock.connectAndSyncAll.mockResolvedValue({
      rateLimited: false,
      transactionCount: 0,
      institutionsRequiringAuth: [
        {
          institution_name: 'Bank of Oklahoma',
          org_conn_id: 'bok',
          message: 'Connection to Bank of Oklahoma may need attention. Auth required',
        },
      ],
    });
    simpleFinServiceMock.getStatus.mockResolvedValueOnce([]).mockResolvedValue([
      {
        is_connected: true,
        last_sync_at: null,
        institution_name: 'Bank A',
        connection_id: 'conn-1',
        transaction_count: 0,
        account_count: 1,
        sync_in_progress: false,
      },
    ]);

    const { result } = renderHook(() => useSimpleFinFlow({ enabled: true, isOnline: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.toast).toBe(
      'Bank of Oklahoma needs to be re-authenticated in your SimpleFIN dashboard.'
    );
  });

  it('sets error and leaves connections unchanged when connect fails', async () => {
    simpleFinServiceMock.getStatus.mockResolvedValue([
      {
        is_connected: true,
        last_sync_at: null,
        institution_name: 'Bank A',
        connection_id: 'conn-1',
        transaction_count: 0,
        account_count: 1,
        sync_in_progress: false,
      },
    ]);
    simpleFinServiceMock.connectAndSyncAll.mockRejectedValue(new Error('claim failed'));

    const { result } = renderHook(() => useSimpleFinFlow({ enabled: true, isOnline: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(1);
    });

    const before = result.current.connections;

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toContain('claim failed');
    expect(result.current.connections).toEqual(before);
    expect(simpleFinServiceMock.syncTransactions).not.toHaveBeenCalled();
  });

  it('exposes plaid-shaped result with null plaidLinkMount', async () => {
    const { result } = renderHook(() => useSimpleFinFlow({ enabled: true, isOnline: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.plaidLinkMount).toBeNull();
  });

  it('syncAll uses a single bridge sync request', async () => {
    simpleFinServiceMock.getStatus.mockResolvedValue([
      {
        is_connected: true,
        last_sync_at: null,
        institution_name: 'Bank A',
        connection_id: 'conn-1',
        transaction_count: 0,
        account_count: 1,
        sync_in_progress: false,
      },
      {
        is_connected: true,
        last_sync_at: null,
        institution_name: 'Bank B',
        connection_id: 'conn-2',
        transaction_count: 0,
        account_count: 1,
        sync_in_progress: false,
      },
    ]);

    const { result } = renderHook(() => useSimpleFinFlow({ enabled: true, isOnline: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(2);
    });

    await act(async () => {
      await result.current.syncAll();
    });

    expect(simpleFinServiceMock.syncBridge).toHaveBeenCalledTimes(1);
    expect(simpleFinServiceMock.syncBridge).toHaveBeenCalledWith('conn-1');
  });
});
