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
      available_providers: ['plaid', 'teller'],
      user_provider: null,
    }),
    selectProvider: jest.fn().mockResolvedValue({
      user_provider: 'teller',
    }),
  });

  it('loads provider catalogue on mount', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProviderCatalog({ gateway }), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.availableProviders).toEqual(['plaid', 'teller']);
    expect(result.current.userProvider).toBeNull();
    expect(gateway.fetchInfo).toHaveBeenCalledTimes(1);
  });

  it('reports teller as not connectable without application id', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProviderCatalog({ gateway }), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canConnectWith('plaid')).toBe(true);
    expect(result.current.canConnectWith('teller')).toBe(false);
    expect(result.current.getConnectBlockedReason('teller')).toBe('Missing credentials');
  });

  it('keeps the selected provider in the shared query cache across remounts', async () => {
    const gateway = createGateway();
    const wrapper = createWrapper();

    const first = renderHook(() => useProviderCatalog({ gateway }), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      await first.result.current.chooseProvider('teller');
    });

    expect(first.result.current.userProvider).toBe('teller');

    first.unmount();

    const second = renderHook(() => useProviderCatalog({ gateway }), { wrapper });

    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.userProvider).toBe('teller');
    expect(gateway.fetchInfo).toHaveBeenCalledTimes(1);
  });
});
