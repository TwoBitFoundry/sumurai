import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { type ProviderCatalogGateway, useProviderCatalog } from '@/hooks/useProviderCatalog';

describe('useProviderCatalog', () => {
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

  const createGateway = (): ProviderCatalogGateway => ({
    fetchInfo: jest.fn().mockResolvedValue({
      available_providers: ['plaid', 'simplefin'],
      user_provider: null,
    }),
    selectProvider: jest.fn().mockResolvedValue({
      user_provider: 'plaid',
    }),
  });

  it('loads provider catalogue on mount', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProviderCatalog({ gateway }), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.availableProviders).toEqual(['plaid', 'simplefin']);
    expect(result.current.userProvider).toBeNull();
    expect(gateway.fetchInfo).toHaveBeenCalledTimes(1);
  });

  it('reports teller as never connectable', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProviderCatalog({ gateway }), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canConnectWith('plaid')).toBe(true);
    expect(result.current.canConnectWith('teller')).toBe(false);
    expect(result.current.getConnectBlockedReason('teller')).toBe('Teller is no longer supported');
  });

  it('keeps the selected provider in the shared query cache across remounts', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();

    const first = renderHook(() => useProviderCatalog({ gateway }), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      await first.result.current.chooseProvider('plaid');
    });

    expect(first.result.current.userProvider).toBe('plaid');

    first.unmount();

    const second = renderHook(() => useProviderCatalog({ gateway }), { wrapper });

    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.userProvider).toBe('plaid');
    expect(gateway.fetchInfo).toHaveBeenCalledTimes(1);
  });

  it('accepts diy as a stored provider selection', async () => {
    const gateway: ProviderCatalogGateway = {
      fetchInfo: jest.fn().mockResolvedValue({
        available_providers: ['plaid', 'simplefin', 'diy'],
        user_provider: 'diy',
      }),
      selectProvider: jest.fn().mockResolvedValue({
        user_provider: 'plaid',
      }),
    };
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProviderCatalog({ gateway }), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.availableProviders).toEqual(['plaid', 'simplefin', 'diy']);
    expect(result.current.userProvider).toBe('diy');
  });
});
