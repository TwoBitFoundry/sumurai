import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { errJson, installFetchRoutes } from '@tests/utils/fetchRoutes';
import { useTellerLinkFlow } from '@/hooks/useTellerLinkFlow';

jest.mock('@/hooks/useTellerConnect', () => ({
  useTellerConnect: () => ({
    ready: true,
    open: jest.fn(),
  }),
}));

describe('useTellerLinkFlow', () => {
  beforeEach(() => {
    installFetchRoutes({
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
  });

  it('rebuilds Teller connections from cached accounts when status has none', async () => {
    const { result } = renderHook(() =>
      useTellerLinkFlow({
        applicationId: 'app_123',
        enabled: true,
        isOnline: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.connections).toHaveLength(1);
    expect(result.current.connections[0].institutionName).toBe('First Platypus Bank');
    expect(result.current.connections[0].accountCount).toBe(2);
    expect(result.current.connections[0].accounts).toHaveLength(2);
  });

  it('does not surface a load error when there are no Teller connections', async () => {
    installFetchRoutes({
      'GET /api/providers/status': {
        provider: 'teller',
        connections: [],
      },
      'GET /api/providers/accounts': [],
    });

    const { result } = renderHook(() =>
      useTellerLinkFlow({
        applicationId: 'app_123',
        enabled: true,
        isOnline: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.connections).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
