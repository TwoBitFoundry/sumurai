import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { errJson, installFetchRoutes } from '@tests/utils/fetchRoutes';
import { useTellerLinkFlow } from '@/hooks/useTellerLinkFlow';

const openMock = jest.fn();
const mockUseTellerConnect = jest.fn(() => ({
  ready: true,
  open: openMock,
}));

jest.mock('@/hooks/useTellerConnect', () => ({
  useTellerConnect: (...args: unknown[]) => mockUseTellerConnect(...args),
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
    openMock.mockReset();
    mockUseTellerConnect.mockReset();
    mockUseTellerConnect.mockImplementation(() => ({
      ready: true,
      open: openMock,
    }));
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

  it('does not pass application id to Teller connect until connect runs', async () => {
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

    expect(mockUseTellerConnect.mock.calls[0][0].applicationId).toBe('');
  });

  it('given offline when connect runs then does not arm Teller with application id', async () => {
    const { result } = renderHook(() =>
      useTellerLinkFlow({
        applicationId: 'app_123',
        enabled: true,
        isOnline: false,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(mockUseTellerConnect.mock.calls.every((c) => c[0].applicationId === '')).toBe(true);
  });
});
