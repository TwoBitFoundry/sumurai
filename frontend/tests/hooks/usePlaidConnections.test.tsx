import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { errJson, installFetchRoutes } from '@tests/utils/fetchRoutes';
import { type ReactNode, useState } from 'react';
import { usePlaidConnections } from '@/hooks/usePlaidConnections';

describe('usePlaidConnections', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>;

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

  beforeEach(() => {
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': {
        provider: 'plaid',
        connections: [],
      },
      'GET /api/providers/accounts': errJson(404, {
        message: 'not found',
      }),
      'GET /api/plaid/accounts': [
        {
          id: 'acc_1',
          name: 'Everyday Checking',
          account_type: 'depository',
          balance_current: 1250.5,
          mask: '0000',
          plaid_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
        },
        {
          id: 'acc_2',
          name: 'High-Yield Savings',
          account_type: 'depository',
          balance_current: 5000,
          mask: '1111',
          plaid_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const getFetchCount = (path: string) =>
    fetchMock.mock.calls.filter(([input]) => String(input).includes(path)).length;

  it('rebuilds connections from cached accounts when status has none', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePlaidConnections(), { wrapper });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(1);
    });
    expect(result.current.connections[0].institutionName).toBe('First Platypus Bank');
    expect(result.current.connections[0].accountCount).toBe(2);
    expect(result.current.connections[0].accounts).toHaveLength(2);
  });

  it('keeps connection updates in the shared query cache across remounts', async () => {
    const wrapper = createWrapper();
    const first = renderHook(() => usePlaidConnections(), { wrapper });

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });

    await act(async () => {
      first.result.current.removeConnection('conn_1');
    });

    await waitFor(() => {
      expect(first.result.current.connections).toHaveLength(0);
    });

    const statusCallsBefore = getFetchCount('/providers/status');
    const accountsCallsBefore = getFetchCount('/plaid/accounts');

    first.unmount();

    const second = renderHook(() => usePlaidConnections(), { wrapper });

    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.connections).toHaveLength(0);
    expect(getFetchCount('/providers/status')).toBe(statusCallsBefore);
    expect(getFetchCount('/plaid/accounts')).toBe(accountsCallsBefore);
  });
});
