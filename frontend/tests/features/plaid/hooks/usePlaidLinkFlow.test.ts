import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import {
  type UsePlaidLinkFlowResult,
  usePlaidLinkFlow,
} from '@/features/plaid/hooks/usePlaidLinkFlow';
import { resetPlaidScriptStateForTests } from '@/features/plaid/plaidLinkScript';

type PlaidFlowOptions = Parameters<typeof usePlaidLinkFlow>[0];

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

const plaidLinkFlowRef = { current: null as UsePlaidLinkFlowResult | null };

function PlaidHookMount({ options }: { options?: PlaidFlowOptions }) {
  const flow = usePlaidLinkFlow(options ?? {});
  plaidLinkFlowRef.current = flow;
  return React.createElement(React.Fragment, null, flow.plaidLinkMount);
}

function renderPlaidFlowMounted(options?: PlaidFlowOptions) {
  plaidLinkFlowRef.current = null;
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(PlaidHookMount, { options })
    )
  );
}

const plaidLinkMock = (() => {
  const open = jest.fn();
  const destroy = jest.fn();
  let config: any = null;
  let error: Error | null = null;
  return {
    open,
    destroy,
    get error() {
      return error;
    },
    getConfig: () => config,
    reset: () => {
      config = null;
      error = null;
      open.mockReset();
      destroy.mockReset();
    },
    setConfig: (opts: any) => {
      config = opts;
    },
    setError: (next: Error | null) => {
      error = next;
    },
  };
})();

const plaidConnectionsMock = {
  connections: [] as any[],
  loading: false,
  error: null as string | null,
  addConnection: jest.fn(),
  removeConnection: jest.fn(),
  updateConnectionSyncInfo: jest.fn(),
  setConnectionSyncInProgress: jest.fn(),
  refresh: jest.fn(),
  getConnection: jest.fn(),
};

jest.mock('react-plaid-link', () => ({
  __esModule: true,
}));

jest.mock('@/hooks/usePlaidConnections', () => ({
  usePlaidConnections: (_options?: any) => plaidConnectionsMock,
}));

jest.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getStatus: jest.fn(),
    exchangeToken: jest.fn(),
    syncTransactions: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('@/services/ApiClient', () => ({
  ApiClient: {
    post: jest.fn(),
  },
}));

jest.mock('@/utils/queryInvalidation', () => ({
  invalidateStaleCacheQueries: jest.fn().mockResolvedValue(undefined),
}));

const plaidServiceMock = jest.requireMock('@/services/PlaidService').PlaidService as Record<
  string,
  jest.Mock
>;
const apiClientMock = jest.requireMock('@/services/ApiClient').ApiClient as { post: jest.Mock };
const invalidateStaleCacheQueriesMock = jest.requireMock('@/utils/queryInvalidation')
  .invalidateStaleCacheQueries as jest.Mock;

describe('usePlaidLinkFlow', () => {
  beforeEach(() => {
    invalidateStaleCacheQueriesMock.mockClear();
    plaidConnectionsMock.connections = [];
    plaidConnectionsMock.loading = false;
    plaidConnectionsMock.error = null;
    plaidConnectionsMock.addConnection.mockReset();
    plaidConnectionsMock.removeConnection.mockReset();
    plaidConnectionsMock.updateConnectionSyncInfo.mockReset();
    plaidConnectionsMock.setConnectionSyncInProgress.mockReset();
    plaidConnectionsMock.refresh.mockReset();
    plaidConnectionsMock.getConnection.mockReset();
    plaidLinkMock.reset();
    resetPlaidScriptStateForTests();
    Object.assign(window, {
      Plaid: {
        create: (opts: any) => {
          plaidLinkMock.setConfig(opts);
          return {
            open: plaidLinkMock.open,
            destroy: plaidLinkMock.destroy,
            exit: (_options?: unknown, callback?: () => void) => {
              callback?.();
            },
          };
        },
      },
    });
    Object.values(plaidServiceMock).forEach((fn) => {
      fn.mockReset();
    });
    apiClientMock.post.mockReset();
  });

  afterEach(() => {
    delete window.Plaid;
  });

  it('does not mount Plaid Link SDK until connect returns a link token', async () => {
    renderPlaidFlowMounted({ onError: jest.fn() });

    await act(async () => {
      await Promise.resolve();
    });

    expect(plaidLinkMock.getConfig()).toBeNull();
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it('exchanges token and refreshes status on success', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.refresh.mockResolvedValue([]);
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-123' });
    plaidServiceMock.exchangeToken.mockResolvedValueOnce({ access_token: 'access' } as any);

    renderPlaidFlowMounted({ onError });

    await act(async () => {
      await plaidLinkFlowRef.current!.connect();
    });

    expect(apiClientMock.post).toHaveBeenCalledWith('/plaid/link-token', {});
    expect(plaidLinkMock.open).toHaveBeenCalled();

    const config = plaidLinkMock.getConfig();
    await act(async () => {
      await config.onSuccess('public-token');
    });

    expect(plaidServiceMock.exchangeToken).toHaveBeenCalledWith('public-token');
    expect(plaidConnectionsMock.refresh).toHaveBeenCalled();
    expect(invalidateStaleCacheQueriesMock).toHaveBeenCalledWith(queryClient, ['plaid']);
    expect(plaidLinkFlowRef.current!.toast).toBe('Bank connected successfully!');
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls.every((call) => call[0] === null)).toBe(true);
  });

  it('invalidates accounts after Plaid sync fails following exchange', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.refresh.mockResolvedValue([
      {
        connectionId: 'conn-1',
        id: 'conn-1',
        institutionName: 'Test Bank',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 1,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ]);
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-123' });
    plaidServiceMock.exchangeToken.mockResolvedValueOnce({ access_token: 'access' } as any);
    plaidServiceMock.syncTransactions.mockRejectedValueOnce(new Error('sync failed'));

    renderPlaidFlowMounted({ onError });

    await act(async () => {
      await plaidLinkFlowRef.current!.connect();
    });

    const config = plaidLinkMock.getConfig();
    await act(async () => {
      await config.onSuccess('public-token');
    });

    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledWith('conn-1');
    expect(invalidateStaleCacheQueriesMock).toHaveBeenCalledWith(queryClient, ['plaid']);
    expect(plaidLinkFlowRef.current!.toast).toBe('Bank connected to Test Bank');
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls.every((call) => call[0] === null)).toBe(true);
  });

  it('provides syncOne, syncAll, and disconnect helpers', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.connections = [
      {
        connectionId: 'bank-1',
        id: 'bank-1',
        institutionName: 'Bank One',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ];
    plaidConnectionsMock.getConnection.mockReturnValue(plaidConnectionsMock.connections[0]);
    plaidServiceMock.syncTransactions.mockResolvedValue({
      transactions: [{ id: 't-1' }],
      metadata: {
        transaction_count: 1,
        account_count: 1,
        sync_timestamp: '2024-01-01T00:00:00Z',
      },
    } as any);
    plaidServiceMock.disconnect.mockResolvedValue({} as any);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }), { wrapper });

    await act(async () => {
      await result.current.syncOne('bank-1');
    });

    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledWith('bank-1');
    expect(result.current.toast).toContain('Synced 1 new transactions from Bank One');

    await act(async () => {
      await result.current.syncAll();
    });

    expect(result.current.syncingAll).toBe(false);
    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.disconnect('bank-1');
    });

    expect(plaidServiceMock.disconnect).toHaveBeenCalledWith('bank-1');
    expect(result.current.toast).toBe('Bank One disconnected successfully');
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls.every((call) => call[0] === null)).toBe(true);
  });

  it('reports errors via onError', async () => {
    const onError = jest.fn();
    apiClientMock.post.mockRejectedValueOnce(new Error('bad request'));

    renderPlaidFlowMounted({ onError });

    await act(async () => {
      await plaidLinkFlowRef.current!.connect().catch(() => {});
    });

    expect(onError).toHaveBeenCalledWith('Failed to start bank connection: bad request');
    expect(plaidLinkFlowRef.current!.error).toBe('Failed to start bank connection: bad request');
  });

  it('shows ad blocker guidance when the Plaid popup is blocked', async () => {
    const onError = jest.fn();
    plaidLinkMock.open.mockImplementation(() => {
      throw new Error('popup blocked');
    });
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-123' });

    renderPlaidFlowMounted({ onError });

    await act(async () => {
      await plaidLinkFlowRef.current!.connect();
    });

    await waitFor(() => {
      expect(plaidLinkFlowRef.current!.error).toContain('ad blocker');
    });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('ad blocker'));
  });

  it('cleans up Plaid SDK state after a script load failure without retrying the same click', async () => {
    const onError = jest.fn();
    delete window.Plaid;
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-1' });
    const appendChildSpy = jest.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => {
        script.dispatchEvent(new Event('error'));
      });
      return node;
    });

    renderPlaidFlowMounted({ onError });

    await act(async () => {
      await plaidLinkFlowRef.current!.connect();
    });

    expect(apiClientMock.post).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(plaidLinkMock.open).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Plaid Link could not load'));
  });
});

describe('usePlaidLinkFlow with OpenTelemetry Instrumentation', () => {
  beforeEach(() => {
    plaidConnectionsMock.connections = [];
    plaidConnectionsMock.loading = false;
    plaidConnectionsMock.error = null;
    plaidConnectionsMock.addConnection.mockReset();
    plaidConnectionsMock.removeConnection.mockReset();
    plaidConnectionsMock.updateConnectionSyncInfo.mockReset();
    plaidConnectionsMock.setConnectionSyncInProgress.mockReset();
    plaidConnectionsMock.refresh.mockReset();
    plaidConnectionsMock.getConnection.mockReset();
    plaidLinkMock.reset();
    resetPlaidScriptStateForTests();
    Object.assign(window, {
      Plaid: {
        create: (opts: any) => {
          plaidLinkMock.setConfig(opts);
          return {
            open: plaidLinkMock.open,
            destroy: plaidLinkMock.destroy,
            exit: (_options?: unknown, callback?: () => void) => {
              callback?.();
            },
          };
        },
      },
    });
    Object.values(plaidServiceMock).forEach((fn) => {
      fn.mockReset();
    });
    apiClientMock.post.mockReset();
  });

  afterEach(() => {
    delete window.Plaid;
  });

  it('should wrap connect callback with instrumentation', async () => {
    const onError = jest.fn();
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-123' });

    renderPlaidFlowMounted({ onError });

    await act(async () => {
      await plaidLinkFlowRef.current!.connect();
    });

    expect(apiClientMock.post).toHaveBeenCalled();
    expect(plaidLinkMock.open).toHaveBeenCalled();
  });

  it('should wrap onSuccess callback with instrumentation', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.refresh.mockResolvedValue([]);
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-123' });
    plaidServiceMock.exchangeToken.mockResolvedValueOnce({ access_token: 'access' } as any);

    renderPlaidFlowMounted({ onError });

    await act(async () => {
      await plaidLinkFlowRef.current!.connect();
    });

    const config = plaidLinkMock.getConfig();
    await act(async () => {
      await config.onSuccess('public-token');
    });

    expect(plaidServiceMock.exchangeToken).toHaveBeenCalledWith('public-token');
    expect(plaidConnectionsMock.refresh).toHaveBeenCalled();
  });

  it('should wrap syncOne callback with instrumentation', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.connections = [
      {
        connectionId: 'bank-1',
        id: 'bank-1',
        institutionName: 'Bank One',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ];
    plaidConnectionsMock.getConnection.mockReturnValue(plaidConnectionsMock.connections[0]);
    plaidServiceMock.syncTransactions.mockResolvedValue({
      transactions: [{ id: 't-1' }],
    } as any);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }), { wrapper });

    await act(async () => {
      await result.current.syncOne('bank-1');
    });

    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledWith('bank-1');
    expect(invalidateStaleCacheQueriesMock).toHaveBeenCalledWith(queryClient, ['plaid']);
  });

  it('should wrap syncAll callback with instrumentation', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.connections = [
      {
        connectionId: 'bank-1',
        id: 'bank-1',
        institutionName: 'Bank One',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ];
    plaidConnectionsMock.getConnection.mockReturnValue(plaidConnectionsMock.connections[0]);
    plaidServiceMock.syncTransactions.mockResolvedValue({
      transactions: [],
    } as any);
    plaidConnectionsMock.refresh.mockResolvedValue([]);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }), { wrapper });

    await act(async () => {
      await result.current.syncAll();
    });

    expect(result.current.syncingAll).toBe(false);
  });

  it('should wrap disconnect callback with instrumentation', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.connections = [
      {
        connectionId: 'bank-1',
        id: 'bank-1',
        institutionName: 'Bank One',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ];
    plaidConnectionsMock.getConnection.mockReturnValue(plaidConnectionsMock.connections[0]);
    plaidServiceMock.disconnect.mockResolvedValue({} as any);
    plaidConnectionsMock.refresh.mockResolvedValue([]);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }), { wrapper });

    await act(async () => {
      await result.current.disconnect('bank-1');
    });

    expect(plaidServiceMock.disconnect).toHaveBeenCalledWith('bank-1');
    expect(invalidateStaleCacheQueriesMock).toHaveBeenCalledWith(queryClient, ['plaid']);
  });

  it('does not request link token until connect runs', async () => {
    renderHook(() => usePlaidLinkFlow({ onError: jest.fn() }), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it('given offline when connect runs then skips link token request', async () => {
    const { result } = renderHook(() => usePlaidLinkFlow({ onError: jest.fn(), isOnline: false }), {
      wrapper,
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(apiClientMock.post).not.toHaveBeenCalledWith('/plaid/link-token', expect.anything());
  });
});
