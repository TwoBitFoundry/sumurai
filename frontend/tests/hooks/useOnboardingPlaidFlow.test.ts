import { jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { resetPlaidScriptStateForTests } from '@/features/plaid/plaidLinkScript';
import {
  type UseOnboardingPlaidFlowReturn,
  useOnboardingPlaidFlow,
} from '@/hooks/useOnboardingPlaidFlow';
import { ApiClient } from '@/services/ApiClient';

const onboardingPlaidFlowRef = { current: null as UseOnboardingPlaidFlowReturn | null };

function OnboardingPlaidMount({
  options,
}: {
  options?: Parameters<typeof useOnboardingPlaidFlow>[0];
}) {
  const flow = useOnboardingPlaidFlow(options ?? {});
  onboardingPlaidFlowRef.current = flow;
  return React.createElement(React.Fragment, null, flow.plaidLinkMount);
}

function renderOnboardingPlaidMounted(options?: Parameters<typeof useOnboardingPlaidFlow>[0]) {
  onboardingPlaidFlowRef.current = null;
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(OnboardingPlaidMount, { options })
    )
  );
}

const plaidOpen = jest.fn();
const plaidDestroy = jest.fn();

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

describe('useOnboardingPlaidFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPlaidScriptStateForTests();
    postSpy = jest.spyOn(ApiClient, 'post');
    getSpy = jest.spyOn(ApiClient, 'get');
    plaidOpen.mockReset();
    plaidDestroy.mockReset();
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
    });
  });

  afterEach(() => {
    postSpy.mockRestore();
    getSpy.mockRestore();
    delete window.Plaid;
  });

  it('given onboarding flow when initialized then starts with disconnected state', () => {
    const { result } = renderHook(() => useOnboardingPlaidFlow(), { wrapper });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionInProgress).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('given onboarding flow when mounted then does not fetch link token', async () => {
    renderHook(() => useOnboardingPlaidFlow(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('given offline when connect initiated then does not fetch link token', async () => {
    const { result } = renderHook(() => useOnboardingPlaidFlow({ isOnline: false }), { wrapper });

    await act(async () => {
      await result.current.initiateConnection();
    });

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('given onboarding flow when connect initiated then opens plaid link', async () => {
    postSpy.mockResolvedValue({ link_token: 'test-link-token' } as any);

    renderOnboardingPlaidMounted();

    await act(async () => {
      await onboardingPlaidFlowRef.current!.initiateConnection();
    });

    expect(postSpy).toHaveBeenCalledWith('/plaid/link-token', {});
    await waitFor(() => {
      expect(plaidOpen).toHaveBeenCalled();
    });
  });

  it('given plaid connection when successful then marks step complete', async () => {
    const onConnectionSuccess = jest.fn();
    postSpy.mockResolvedValueOnce({} as any); // exchangeToken
    getSpy.mockResolvedValueOnce({
      connections: [
        {
          connection_id: 'conn-1',
          institution_name: 'Connected Bank',
          is_connected: true,
          accounts: [],
        },
      ],
    });
    postSpy.mockResolvedValueOnce({ transactions: [], metadata: {} } as any);

    const { result } = renderHook(() => useOnboardingPlaidFlow({ onConnectionSuccess }), {
      wrapper,
    });

    await act(async () => {
      await result.current.handlePlaidSuccess('test-public-token');
    });

    expect(postSpy).toHaveBeenCalledWith('/plaid/exchange-token', {
      public_token: 'test-public-token',
    });
    expect(result.current.isConnected).toBe(true);
    expect(result.current.institutionName).toBe('Connected Bank');
    expect(onConnectionSuccess).toHaveBeenCalledWith('Connected Bank');
    expect(getSpy).toHaveBeenCalledWith('/providers/status');
  });

  it('given plaid status fetch fails after exchange then still marks connected', async () => {
    const onConnectionSuccess = jest.fn();
    postSpy.mockResolvedValueOnce({} as any); // exchangeToken
    getSpy.mockRejectedValue(new Error('status error'));

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useOnboardingPlaidFlow({ onConnectionSuccess }), {
      wrapper,
    });

    await act(async () => {
      await result.current.handlePlaidSuccess('test-public-token');
    });

    expect(result.current.isConnected).toBe(true);
    expect(onConnectionSuccess).toHaveBeenCalledWith('Connected Bank');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('given plaid connection when failed then shows error state', async () => {
    const onError = jest.fn();
    const mockError = new Error('Connection failed');
    postSpy.mockRejectedValue(mockError);

    const { result } = renderHook(() => useOnboardingPlaidFlow({ onError }), { wrapper });

    await act(async () => {
      await result.current.handlePlaidSuccess('test-public-token');
    });

    expect(result.current.error).toBe('Connection failed');
    expect(result.current.isConnected).toBe(false);
    expect(onError).toHaveBeenCalledWith('Connection failed');
  });

  it('given link token request when fails then handles error gracefully', async () => {
    const onError = jest.fn();
    const mockError = new Error('Failed to get link token');
    postSpy.mockRejectedValue(mockError);

    renderOnboardingPlaidMounted({ onError });

    await act(async () => {
      await onboardingPlaidFlowRef.current!.initiateConnection();
    });

    expect(onboardingPlaidFlowRef.current!.error).toBe('Failed to get link token');
    expect(onError).toHaveBeenCalledWith('Failed to get link token');
  });

  it('given connection error when retry called then clears error and retries', async () => {
    postSpy.mockResolvedValueOnce({ link_token: 'test-link-token' } as any);

    renderOnboardingPlaidMounted();

    act(() => {
      onboardingPlaidFlowRef.current!.setError('Previous error');
    });

    await act(async () => {
      await onboardingPlaidFlowRef.current!.retryConnection();
    });

    expect(onboardingPlaidFlowRef.current!.error).toBe(null);
    expect(postSpy).toHaveBeenCalledWith('/plaid/link-token', {});
  });

  it('given Plaid SDK script fails when retry called then fetches a fresh link token from a user action', async () => {
    delete window.Plaid;
    postSpy.mockResolvedValueOnce({ link_token: 'test-link-token' } as any);
    postSpy.mockResolvedValueOnce({ link_token: 'retry-link-token' } as any);
    const appendChildSpy = jest.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => {
        script.dispatchEvent(new Event('error'));
      });
      return node;
    });

    renderOnboardingPlaidMounted();

    await act(async () => {
      await onboardingPlaidFlowRef.current!.initiateConnection();
    });

    expect(onboardingPlaidFlowRef.current!.error).toContain('Plaid Link could not load');

    await act(async () => {
      await onboardingPlaidFlowRef.current!.retryConnection();
    });

    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(appendChildSpy).toHaveBeenCalledTimes(2);
    appendChildSpy.mockRestore();
  });

  it('given onboarding flow when reset then returns to initial state', () => {
    const { result } = renderHook(() => useOnboardingPlaidFlow(), { wrapper });

    act(() => {
      result.current.setError('Test error');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.connectionInProgress).toBe(false);
    expect(result.current.institutionName).toBe(null);
  });
});
