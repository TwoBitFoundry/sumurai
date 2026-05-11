import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { errJson, installFetchRoutes } from '@tests/utils/fetchRoutes';
import { usePlaidConnections } from '@/hooks/usePlaidConnections';

describe('usePlaidConnections', () => {
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

  it('rebuilds connections from cached accounts when status has none', async () => {
    const { result } = renderHook(() => usePlaidConnections());

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
});
