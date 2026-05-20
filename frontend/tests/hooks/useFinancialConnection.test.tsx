import { jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { resetPlaidScriptStateForTests } from '@/features/plaid/plaidLinkScript';
import { resetTellerScriptStateForTests } from '@/features/teller/tellerConnectScript';
import {
  type UseFinancialConnectionReturn,
  useFinancialConnection,
} from '@/hooks/useFinancialConnection';
import { ApiClient } from '@/services/ApiClient';

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

let postSpy: jest.SpiedFunction<typeof ApiClient.post>;
let getSpy: jest.SpiedFunction<typeof ApiClient.get>;

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
    resetPlaidScriptStateForTests();
    resetTellerScriptStateForTests();
    postSpy = jest.spyOn(ApiClient, 'post');
    getSpy = jest.spyOn(ApiClient, 'get');
    getSpy.mockImplementation((url, _params) => {
      if (url === '/providers/info') {
        return Promise.resolve({
          available_providers: ['plaid', 'teller'],
          default_provider: 'plaid',
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
        create: () => ({
          open: plaidOpen,
          destroy: plaidDestroy,
          exit: (_options?: unknown, callback?: () => void) => {
            callback?.();
          },
        }),
      },
      TellerConnect: {
        setup: tellerSetup,
      },
    });
  });

  afterEach(() => {
    postSpy.mockRestore();
    getSpy.mockRestore();
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

    await act(async () => {
      void connectionFlowRef.current?.initiateConnection();
    });

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/plaid/link-token', {});
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

    await act(async () => {
      void connectionFlowRef.current?.initiateConnection();
    });

    await waitFor(() => {
      expect(tellerSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: 'app-123',
          environment: 'development',
        })
      );
    });
  });

  it('given connect before strategy bridge mounts when connect called then reports not ready', async () => {
    const { result } = renderHook(
      () => useFinancialConnection({ provider: 'plaid', isOnline: true }),
      { wrapper }
    );

    await act(async () => {
      await result.current.initiateConnection();
    });

    expect(result.current.error).toBe('Connection is not ready. Please try again.');
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
});
