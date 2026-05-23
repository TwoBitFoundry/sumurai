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
    submitSetupToken: jest.fn(),
    getStatus: jest.fn(),
    syncTransactions: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('@/utils/queryInvalidation', () => ({
  invalidateStaleCacheQueries: jest.fn().mockResolvedValue(undefined),
}));

const simpleFinServiceMock = jest.requireMock('@/services/SimpleFinService')
  .SimpleFinService as Record<string, jest.Mock>;

describe('useSimpleFinFlow', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
    simpleFinServiceMock.getStatus.mockResolvedValue([]);
    simpleFinServiceMock.syncTransactions.mockResolvedValue({ transactions: [], metadata: {} });
  });

  it('submitSetupToken calls service then syncAll and repopulates connections', async () => {
    simpleFinServiceMock.submitSetupToken.mockResolvedValue({
      connection_id: 'conn-1',
      institution_name: 'SimpleFIN (2 institutions)',
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
      await result.current.submitSetupToken('abc');
    });

    expect(simpleFinServiceMock.submitSetupToken).toHaveBeenCalledWith('abc');
    expect(simpleFinServiceMock.syncTransactions).toHaveBeenCalledWith('conn-1');
    expect(simpleFinServiceMock.syncTransactions).toHaveBeenCalledWith('conn-2');

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(2);
    });
    expect(result.current.error).toBeNull();
  });

  it('sets error and leaves connections unchanged when submitSetupToken fails', async () => {
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
    simpleFinServiceMock.submitSetupToken.mockRejectedValue(new Error('claim failed'));

    const { result } = renderHook(() => useSimpleFinFlow({ enabled: true, isOnline: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(1);
    });

    const before = result.current.connections;

    await act(async () => {
      await result.current.submitSetupToken('bad-token');
    });

    expect(result.current.error).toContain('claim failed');
    expect(result.current.connections).toEqual(before);
    expect(simpleFinServiceMock.syncTransactions).not.toHaveBeenCalled();
  });

  it('exposes plaid-shaped result with noop connect and null plaidLinkMount', async () => {
    const { result } = renderHook(() => useSimpleFinFlow({ enabled: true, isOnline: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.plaidLinkMount).toBeNull();
    expect(simpleFinServiceMock.submitSetupToken).not.toHaveBeenCalled();
  });
});
