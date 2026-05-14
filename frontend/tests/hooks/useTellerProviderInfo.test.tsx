import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import type { TellerProviderGateway } from '@/hooks/useTellerProviderInfo';
import { useTellerProviderInfo } from '@/hooks/useTellerProviderInfo';

describe('useTellerProviderInfo', () => {
  const createWrapper = () => {
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

    return function Wrapper({ children }: { children: ReactNode }) {
      const [client] = useState(queryClient);

      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };
  };

  const createGateway = (): TellerProviderGateway => ({
    fetchInfo: jest.fn().mockResolvedValue({
      available_providers: ['plaid', 'teller'],
      default_provider: 'plaid',
      user_provider: undefined,
    }),
    selectProvider: jest.fn().mockResolvedValue({
      user_provider: 'teller',
    }),
  });

  it('loads provider catalogue on mount', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTellerProviderInfo({ gateway }), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.availableProviders).toEqual(['plaid', 'teller']);
    expect(result.current.selectedProvider).toBe('plaid');
    expect(gateway.fetchInfo).toHaveBeenCalledTimes(1);
  });

  it('keeps the selected provider in the shared query cache across remounts', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();

    const first = renderHook(() => useTellerProviderInfo({ gateway }), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      await first.result.current.chooseProvider('teller');
    });

    expect(first.result.current.selectedProvider).toBe('teller');

    first.unmount();

    const second = renderHook(() => useTellerProviderInfo({ gateway }), { wrapper });

    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.selectedProvider).toBe('teller');
    expect(gateway.fetchInfo).toHaveBeenCalledTimes(1);
  });

  it('selects provider through gateway', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTellerProviderInfo({ gateway }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.chooseProvider('teller');
    });

    expect(gateway.selectProvider).toHaveBeenCalledWith('teller');
    expect(result.current.selectedProvider).toBe('teller');
  });

  it('keeps the last catalogue when refresh fails', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTellerProviderInfo({ gateway }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    gateway.fetchInfo = jest.fn().mockRejectedValueOnce(new Error('offline'));

    await act(async () => {
      await result.current.refresh().catch(() => {});
    });

    expect(result.current.selectedProvider).toBe('plaid');
    expect(result.current.availableProviders).toEqual(['plaid', 'teller']);
  });
});
