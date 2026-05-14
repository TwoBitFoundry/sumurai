import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { errJson, installFetchRoutes } from '@tests/utils/fetchRoutes';
import React, { type ReactNode, useState } from 'react';
import { resetTellerScriptStateForTests } from '@/hooks/useTellerConnect';
import { type UseTellerLinkFlowResult, useTellerLinkFlow } from '@/hooks/useTellerLinkFlow';

type TellerLinkFlowOptions = Parameters<typeof useTellerLinkFlow>[0];

const tellerLinkFlowRef = { current: null as UseTellerLinkFlowResult | null };

function TellerLinkMountHost({ props }: { props: TellerLinkFlowOptions }) {
  const flow = useTellerLinkFlow(props);
  tellerLinkFlowRef.current = flow;
  return React.createElement(React.Fragment, null, flow.tellerConnectMount);
}

const setup = jest.fn();
const openMock = jest.fn();

jest.mock('@/utils/queryInvalidation', () => ({
  invalidateStaleCacheQueries: jest.fn().mockResolvedValue(undefined),
}));

const invalidateStaleCacheQueriesMock = jest.requireMock('@/utils/queryInvalidation')
  .invalidateStaleCacheQueries as jest.Mock;

describe('useTellerLinkFlow', () => {
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
    resetTellerScriptStateForTests();
    jest.clearAllMocks();
    invalidateStaleCacheQueriesMock.mockClear();
    openMock.mockReset();
    setup.mockReturnValue({ open: openMock, destroy: jest.fn() });
    Object.assign(window, {
      TellerConnect: { setup },
    });
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
          provider_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
        },
        {
          id: 'acc_2',
          name: 'High-Yield Savings',
          account_type: 'depository',
          balance_current: 5000,
          mask: '1111',
          provider_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    openMock.mockReset();
    delete window.TellerConnect;
  });

  const getFetchCount = (path: string) =>
    fetchMock.mock.calls.filter(([input]) => String(input).includes(path)).length;

  it('rebuilds Teller connections from cached accounts when status has none', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useTellerLinkFlow({
          applicationId: 'app_123',
          enabled: true,
          isOnline: true,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.connections).toHaveLength(1);
    expect(result.current.connections[0].institutionName).toBe('First Platypus Bank');
    expect(result.current.connections[0].accountCount).toBe(2);
    expect(result.current.connections[0].accounts).toHaveLength(2);
  });

  it('invalidates shared caches after Teller load when balances are already populated', async () => {
    installFetchRoutes({
      'GET /api/providers/status': {
        provider: 'teller',
        connections: [
          {
            connection_id: 'conn_1',
            institution_name: 'First Platypus Bank',
            is_connected: true,
            last_sync_at: '2024-01-01T00:00:00Z',
            transaction_count: 2,
            account_count: 2,
            sync_in_progress: false,
          },
        ],
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
          provider_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
        },
      ],
      'POST /api/providers/connect': {
        connection_id: 'conn_1',
      },
      'POST /api/providers/sync-transactions': {},
    });

    tellerLinkFlowRef.current = null;
    const wrapper = createWrapper();
    render(
      React.createElement(TellerLinkMountHost, {
        props: {
          applicationId: 'app_123',
          enabled: true,
          isOnline: true,
        },
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(tellerLinkFlowRef.current?.loading).toBe(false);
    });

    await act(async () => {
      await tellerLinkFlowRef.current!.connect();
    });

    await waitFor(() => {
      expect(setup).toHaveBeenCalled();
    });

    const config = setup.mock.calls[0][0];
    await act(async () => {
      await config.onSuccess({
        accessToken: 'access-token',
        user: { id: 'user-1' },
        enrollment: {
          id: 'enroll-1',
          institution: {
            name: 'First Platypus Bank',
          },
        },
      });
    });

    await waitFor(() => {
      expect(invalidateStaleCacheQueriesMock).toHaveBeenCalledWith(expect.anything(), ['teller']);
    });
  });

  it('keeps Teller connections in the shared query cache across remounts', async () => {
    const wrapper = createWrapper();
    const first = renderHook(
      () =>
        useTellerLinkFlow({
          applicationId: 'app_123',
          enabled: true,
          isOnline: true,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });

    expect(first.result.current.connections).toHaveLength(1);

    const statusCallsBefore = getFetchCount('/providers/status');
    const accountsCallsBefore = getFetchCount('/plaid/accounts');

    first.unmount();

    const second = renderHook(
      () =>
        useTellerLinkFlow({
          applicationId: 'app_123',
          enabled: true,
          isOnline: true,
        }),
      { wrapper }
    );

    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.connections).toHaveLength(1);
    expect(getFetchCount('/providers/status')).toBe(statusCallsBefore);
    expect(getFetchCount('/plaid/accounts')).toBe(accountsCallsBefore);
  });

  it('does not surface a load error when there are no Teller connections', async () => {
    installFetchRoutes({
      'GET /api/providers/status': {
        provider: 'teller',
        connections: [],
      },
      'GET /api/providers/accounts': [],
    });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useTellerLinkFlow({
          applicationId: 'app_123',
          enabled: true,
          isOnline: true,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.connections).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('does not pass application id to Teller connect until connect runs', async () => {
    tellerLinkFlowRef.current = null;
    const wrapper = createWrapper();
    render(
      React.createElement(TellerLinkMountHost, {
        props: { applicationId: 'app_123', enabled: true, isOnline: true },
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(tellerLinkFlowRef.current!.loading).toBe(false);
    });

    expect(setup).not.toHaveBeenCalled();
  });

  it('given offline when connect runs then does not arm Teller with application id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useTellerLinkFlow({
          applicationId: 'app_123',
          enabled: true,
          isOnline: false,
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(setup).not.toHaveBeenCalled();
  });
});
