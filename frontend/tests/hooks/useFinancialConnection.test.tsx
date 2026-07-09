import { jest } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { resetPlaidScriptStateForTests } from '@/features/plaid/plaidLinkScript';
import {
  type UseFinancialConnectionReturn,
  useFinancialConnection,
} from '@/hooks/useFinancialConnection';
import { ApiClient } from '@/services/ApiClient';
import type { SyncProvider } from '@/utils/queryInvalidation';

const connectionFlowRef = { current: null as UseFinancialConnectionReturn | null };

function FinancialConnectionMount({ provider }: { provider: 'plaid' | 'simplefin' | 'teller' }) {
  const flow = useFinancialConnection({
    provider,
    isOnline: true,
  });
  connectionFlowRef.current = flow;
  return React.createElement(React.Fragment, null, flow.connectionMount);
}

const plaidOpen = jest.fn();
const plaidDestroy = jest.fn();
type PlaidMockConfig = {
  onSuccess: (token: string, metadata?: unknown) => Promise<void>;
  onExit?: (...args: unknown[]) => void;
};
const plaidLinkMock = (() => {
  let config: PlaidMockConfig | null = null;
  return {
    open: plaidOpen,
    destroy: plaidDestroy,
    getConfig: () => config,
    setConfig: (next: PlaidMockConfig) => {
      config = next;
    },
    reset: () => {
      config = null;
      plaidOpen.mockReset();
      plaidDestroy.mockReset();
    },
  };
})();

function SwitchableFinancialConnectionMount() {
  const [provider, setProvider] = useState<SyncProvider>('plaid');
  const flow = useFinancialConnection({
    provider,
    isOnline: true,
  });
  connectionFlowRef.current = flow;
  return React.createElement(
    React.Fragment,
    null,
    flow.connectionMount,
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: () => setProvider('simplefin'),
      },
      'switch-provider'
    )
  );
}

let postSpy: jest.SpiedFunction<typeof ApiClient.post>;
let getSpy: jest.SpiedFunction<typeof ApiClient.get>;
let invalidateQueriesSpy: jest.SpiedFunction<QueryClient['invalidateQueries']>;

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

describe('useFinancialConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateQueriesSpy = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined as never);
    plaidLinkMock.reset();
    resetPlaidScriptStateForTests();
    postSpy = jest.spyOn(ApiClient, 'post');
    getSpy = jest.spyOn(ApiClient, 'get');
    getSpy.mockImplementation((url, _params) => {
      if (url === '/providers/info') {
        return Promise.resolve({
          available_providers: ['plaid', 'simplefin'],
        } as any);
      }
      return Promise.resolve({});
    });
    plaidOpen.mockReset();
    plaidDestroy.mockReset();

    Object.assign(window, {
      Plaid: {
        create: (opts: PlaidMockConfig) => {
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
  });

  afterEach(() => {
    postSpy.mockRestore();
    getSpy.mockRestore();
    invalidateQueriesSpy.mockRestore();
    delete window.Plaid;
  });

  it('given plaid connection when initialized then starts with disconnected state', () => {
    const { result } = renderHook(
      () => useFinancialConnection({ provider: 'plaid', isOnline: true }),
      { wrapper }
    );

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionInProgress).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('given legacy teller provider when initialized then starts disconnected without connect readiness', () => {
    const { result } = renderHook(
      () =>
        useFinancialConnection({
          provider: 'teller',
          isOnline: true,
        }),
      { wrapper }
    );

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionInProgress).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('given plaid connection when connect is called then fetches link token and opens Plaid', async () => {
    postSpy.mockResolvedValueOnce({ link_token: 'link-token-123' });

    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(FinancialConnectionMount, { provider: 'plaid' })
      )
    );

    await waitFor(() => {
      expect(plaidLinkMock.getConfig()).not.toBeNull();
    });

    await act(async () => {
      await connectionFlowRef.current?.initiateConnection();
    });

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/plaid/link-token', {});
    });
    await waitFor(() => {
      expect(plaidOpen).toHaveBeenCalledTimes(1);
    });
  });

  it('given legacy teller provider when connect is called then surfaces sunset message', async () => {
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(FinancialConnectionMount, { provider: 'teller' as any })
      )
    );

    await act(async () => {
      await connectionFlowRef.current?.initiateConnection();
    });

    await waitFor(() => {
      expect(connectionFlowRef.current?.error).toMatch(/no longer supported/i);
    });
  });

  it('given connect before strategy bridge mounts when connect called then reports not ready', async () => {
    const onError = jest.fn();
    const { result } = renderHook(
      () => useFinancialConnection({ provider: 'plaid', isOnline: true, onError }),
      { wrapper }
    );

    await act(async () => {
      await result.current.initiateConnection();
    });

    expect(onError).toHaveBeenCalledWith('Connection is not ready. Please try again.');
    expect(postSpy).not.toHaveBeenCalledWith('/plaid/link-token', {});
  });

  it('given connection when reset is called then clears state', () => {
    const { result } = renderHook(
      () => useFinancialConnection({ provider: 'plaid', isOnline: true }),
      { wrapper }
    );

    act(() => {
      result.current.reset();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionInProgress).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('given plaid success when exchange completes then invalidates plaid cache', async () => {
    postSpy.mockImplementation((url) => {
      if (url === '/plaid/link-token') {
        return Promise.resolve({ link_token: 'link-token-123' } as never);
      }
      if (url === '/plaid/exchange-token') {
        return Promise.resolve({
          connection_id: 'conn-1',
          institution_name: 'Test Bank',
        } as never);
      }
      if (url === '/providers/sync-transactions') {
        return Promise.resolve({} as never);
      }
      return Promise.resolve({} as never);
    });
    getSpy.mockImplementation((url) => {
      if (url === '/providers/status') {
        return Promise.resolve({
          provider: 'plaid',
          connections: [
            {
              connection_id: 'conn-1',
              institution_name: 'Test Bank',
              is_connected: true,
              last_sync_at: null,
              transaction_count: 0,
              account_count: 1,
              sync_in_progress: false,
            },
          ],
        } as never);
      }
      return Promise.resolve({} as never);
    });

    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(FinancialConnectionMount, { provider: 'plaid' })
      )
    );

    await act(async () => {
      await waitFor(() => {
        expect(plaidLinkMock.getConfig()).not.toBeNull();
      });
      await connectionFlowRef.current?.initiateConnection();
    });

    await waitFor(() => {
      expect(plaidLinkMock.getConfig()).not.toBeNull();
    });

    await act(async () => {
      await plaidLinkMock.getConfig()?.onSuccess('public-token', {} as never);
    });

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/plaid/exchange-token', {
        public_token: 'public-token',
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['plaid', 'connections'] })
      );
    });
  });

  it('given plaid connection exits when reconnecting then fetches a new link token', async () => {
    postSpy.mockResolvedValue({ link_token: 'link-token-123' });

    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(FinancialConnectionMount, { provider: 'plaid' })
      )
    );

    await waitFor(() => {
      expect(plaidLinkMock.getConfig()).not.toBeNull();
    });

    expect(postSpy.mock.calls.filter(([url]) => url === '/plaid/link-token')).toHaveLength(1);

    await act(async () => {
      plaidLinkMock.getConfig()?.onExit?.(null);
    });

    await waitFor(() => {
      expect(postSpy.mock.calls.filter(([url]) => url === '/plaid/link-token')).toHaveLength(2);
    });

    await act(async () => {
      await connectionFlowRef.current?.retryConnection();
    });

    await waitFor(() => {
      expect(plaidOpen).toHaveBeenCalledTimes(1);
    });
  });

  it('given provider switch when simplefin is selected then stops using plaid link token flow', async () => {
    postSpy.mockResolvedValue({ link_token: 'link-token-123' });

    const { getByRole } = render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(SwitchableFinancialConnectionMount)
      )
    );

    await waitFor(() => {
      expect(plaidLinkMock.getConfig()).not.toBeNull();
    });

    await act(async () => {
      await connectionFlowRef.current?.initiateConnection();
    });

    expect(plaidOpen).toHaveBeenCalledTimes(1);

    await act(async () => {
      getByRole('button', { name: 'switch-provider' }).click();
    });

    expect(connectionFlowRef.current?.isReady).toBe(true);
    expect(postSpy.mock.calls.filter(([url]) => url === '/plaid/link-token')).toHaveLength(1);
  });
});
