import { jest } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { resetPlaidScriptStateForTests } from '@/features/plaid/plaidLinkScript';
import { resetTellerScriptStateForTests } from '@/features/teller/tellerConnectScript';
import {
  type UseFinancialConnectionReturn,
  useFinancialConnection,
} from '@/hooks/useFinancialConnection';
import { ApiClient } from '@/services/ApiClient';
import type { SyncProvider } from '@/utils/queryInvalidation';

const connectionFlowRef = { current: null as UseFinancialConnectionReturn | null };

function FinancialConnectionMount({ provider }: { provider: 'plaid' | 'teller' }) {
  const flow = useFinancialConnection({
    provider,
    isOnline: true,
  });
  connectionFlowRef.current = flow;
  return React.createElement(React.Fragment, null, flow.connectionMount);
}

const plaidOpen = jest.fn();
const plaidDestroy = jest.fn();
const tellerSetup = jest.fn();
const tellerOpen = jest.fn();
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
        onClick: () => setProvider('teller'),
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
    resetTellerScriptStateForTests();
    postSpy = jest.spyOn(ApiClient, 'post');
    getSpy = jest.spyOn(ApiClient, 'get');
    getSpy.mockImplementation((url, _params) => {
      if (url === '/providers/info') {
        return Promise.resolve({
          available_providers: ['plaid', 'teller'],
          teller_application_id: 'app-123',
          teller_environment: 'development',
        } as any);
      }
      return Promise.resolve({});
    });
    plaidOpen.mockReset();
    plaidDestroy.mockReset();
    tellerOpen.mockReset();
    tellerSetup.mockReset();

    tellerSetup.mockReturnValue({ open: tellerOpen, destroy: jest.fn() });

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
      TellerConnect: {
        setup: tellerSetup,
      },
    });
  });

  afterEach(() => {
    postSpy.mockRestore();
    getSpy.mockRestore();
    invalidateQueriesSpy.mockRestore();
    delete window.Plaid;
    delete window.TellerConnect;
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

  it('given teller connection when initialized then starts with disconnected state', () => {
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

  it('given teller connection when connect is called then arms Teller connect and opens it', async () => {
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(FinancialConnectionMount, { provider: 'teller' })
      )
    );

    await waitFor(() => {
      expect(tellerSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: 'app-123',
          environment: 'development',
          products: ['balance', 'transactions'],
        })
      );
    });

    await act(async () => {
      void connectionFlowRef.current?.initiateConnection();
    });

    await waitFor(() => {
      expect(tellerOpen).toHaveBeenCalledTimes(1);
    });
  });

  it('given teller connection when mounted then prepares Teller before the user clicks', async () => {
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(FinancialConnectionMount, { provider: 'teller' })
      )
    );

    await waitFor(() => {
      expect(connectionFlowRef.current?.isReady).toBe(true);
    });

    expect(tellerSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-123',
      })
    );
  });

  it('given teller reconnect after prior open when connect is called then reuses ready Teller instance', async () => {
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(FinancialConnectionMount, { provider: 'teller' })
      )
    );

    await act(async () => {
      await connectionFlowRef.current?.initiateConnection();
    });

    await waitFor(() => {
      expect(tellerSetup).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await connectionFlowRef.current?.initiateConnection();
    });

    expect(tellerSetup).toHaveBeenCalledTimes(1);
    expect(tellerOpen).toHaveBeenCalledTimes(2);
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

  it('given teller success when enrollment completes then invalidates teller cache', async () => {
    getSpy.mockImplementation((url) => {
      if (url === '/providers/info') {
        return Promise.resolve({
          available_providers: ['plaid', 'teller'],
          teller_application_id: 'app-123',
          teller_environment: 'development',
        } as never);
      }
      if (url === '/providers/status') {
        return Promise.resolve({
          provider: 'teller',
          connections: [
            {
              connection_id: 'conn-teller',
              institution_name: 'Teller Bank',
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
    postSpy.mockImplementation((url) => {
      if (url === '/providers/connect') {
        return Promise.resolve({ connection_id: 'conn-teller' } as never);
      }
      if (url === '/providers/sync-transactions') {
        return Promise.resolve({} as never);
      }
      return Promise.resolve({} as never);
    });

    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(FinancialConnectionMount, { provider: 'teller' })
      )
    );

    await act(async () => {
      await connectionFlowRef.current?.initiateConnection();
    });

    await waitFor(() => {
      expect(tellerSetup).toHaveBeenCalled();
    });

    const config = tellerSetup.mock.calls[0][0];
    await act(async () => {
      await config.onSuccess({
        accessToken: 'access-token',
        user: { id: 'user-1' },
        enrollment: {
          id: 'enroll-1',
          institution: { name: 'Teller Bank' },
        },
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['teller', 'connections'] })
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

  it('given provider switch when teller connect runs then uses teller strategy only', async () => {
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

    expect(tellerSetup).not.toHaveBeenCalled();
    expect(plaidOpen).toHaveBeenCalledTimes(1);

    await act(async () => {
      getByRole('button', { name: 'switch-provider' }).click();
    });

    await act(async () => {
      await connectionFlowRef.current?.initiateConnection();
    });

    await waitFor(() => {
      expect(tellerSetup).toHaveBeenCalled();
    });
    expect(postSpy.mock.calls.filter(([url]) => url === '/plaid/link-token')).toHaveLength(1);
  });
});
