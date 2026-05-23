import { act, renderHook, waitFor } from '@testing-library/react';
import {
  connectionActions,
  initialFinancialConnectionState,
} from '@/hooks/financialConnection/connectionState';
import { useSimpleFinConnectionStrategy } from '@/hooks/financialConnection/useSimpleFinConnectionStrategy';

jest.mock('@/services/SimpleFinService', () => ({
  SimpleFinService: {
    getStatus: jest.fn(),
    connectAndSyncAll: jest.fn(),
  },
}));

const simpleFinServiceMock = jest.requireMock('@/services/SimpleFinService')
  .SimpleFinService as Record<string, jest.Mock>;

describe('useSimpleFinConnectionStrategy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    simpleFinServiceMock.connectAndSyncAll.mockResolvedValue({
      rateLimited: false,
      transactionCount: 0,
    });
  });

  it('patches connected state when status reports active connections', async () => {
    simpleFinServiceMock.getStatus.mockResolvedValue([
      {
        is_connected: true,
        last_sync_at: '2024-01-01T00:00:00Z',
        institution_name: 'Bank A',
        connection_id: 'conn-1',
        transaction_count: 1,
        account_count: 1,
        sync_in_progress: false,
      },
    ]);

    const dispatch = jest.fn();
    const onConnectionSuccess = jest.fn();
    const invalidateCache = jest.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useSimpleFinConnectionStrategy({
        isOnline: true,
        sdkNonce: 0,
        setSdkNonce: jest.fn(),
        sdkFailedRef: { current: false },
        state: initialFinancialConnectionState,
        dispatch,
        handleError: jest.fn(),
        onConnectionSuccess,
        invalidateCache,
        tellerApplicationId: null,
        tellerEnvironment: 'development',
      })
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        connectionActions.patch({ isConnected: true, institutionName: 'Bank A' })
      );
    });
    expect(onConnectionSuccess).toHaveBeenCalledWith('Bank A');
  });

  it('uses institution count label when multiple connections are active', async () => {
    simpleFinServiceMock.getStatus.mockResolvedValue([
      {
        is_connected: true,
        last_sync_at: null,
        institution_name: 'Bank A',
        connection_id: 'conn-1',
        transaction_count: 0,
        account_count: 1,
        sync_in_progress: false,
      },
      {
        is_connected: true,
        last_sync_at: null,
        institution_name: 'Bank B',
        connection_id: 'conn-2',
        transaction_count: 0,
        account_count: 1,
        sync_in_progress: false,
      },
    ]);

    const dispatch = jest.fn();

    renderHook(() =>
      useSimpleFinConnectionStrategy({
        isOnline: true,
        sdkNonce: 0,
        setSdkNonce: jest.fn(),
        sdkFailedRef: { current: false },
        state: initialFinancialConnectionState,
        dispatch,
        handleError: jest.fn(),
        onConnectionSuccess: jest.fn(),
        invalidateCache: jest.fn().mockResolvedValue(undefined),
        tellerApplicationId: null,
        tellerEnvironment: 'development',
      })
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        connectionActions.patch({
          isConnected: true,
          institutionName: '2 institutions connected',
        })
      );
    });
  });

  it('marks disconnected when status has no active connections', async () => {
    simpleFinServiceMock.getStatus.mockResolvedValue([
      {
        is_connected: false,
        last_sync_at: null,
        institution_name: 'Bank A',
        connection_id: 'conn-1',
        transaction_count: 0,
        account_count: 0,
        sync_in_progress: false,
      },
    ]);

    const dispatch = jest.fn();

    const { result } = renderHook(() =>
      useSimpleFinConnectionStrategy({
        isOnline: true,
        sdkNonce: 0,
        setSdkNonce: jest.fn(),
        sdkFailedRef: { current: false },
        state: initialFinancialConnectionState,
        dispatch,
        handleError: jest.fn(),
        onConnectionSuccess: jest.fn(),
        invalidateCache: jest.fn().mockResolvedValue(undefined),
        tellerApplicationId: null,
        tellerEnvironment: 'development',
      })
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        connectionActions.patch({ isConnected: false, institutionName: null })
      );
    });

    expect(result.current.getReady()).toBe(true);
    expect(result.current.render()).toBeNull();
  });

  it('open is a no-op and load does not throw', async () => {
    simpleFinServiceMock.getStatus.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useSimpleFinConnectionStrategy({
        isOnline: true,
        sdkNonce: 0,
        setSdkNonce: jest.fn(),
        sdkFailedRef: { current: false },
        state: initialFinancialConnectionState,
        dispatch: jest.fn(),
        handleError: jest.fn(),
        onConnectionSuccess: jest.fn(),
        invalidateCache: jest.fn().mockResolvedValue(undefined),
        tellerApplicationId: null,
        tellerEnvironment: 'development',
      })
    );

    await act(async () => {
      result.current.open();
      await result.current.load();
    });

    expect(result.current.getReady()).toBe(true);
  });

  it('passes the provided setup token through to the SimpleFIN connect flow', async () => {
    simpleFinServiceMock.getStatus.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useSimpleFinConnectionStrategy({
        isOnline: true,
        sdkNonce: 0,
        setSdkNonce: jest.fn(),
        sdkFailedRef: { current: false },
        state: initialFinancialConnectionState,
        dispatch: jest.fn(),
        handleError: jest.fn(),
        onConnectionSuccess: jest.fn(),
        invalidateCache: jest.fn().mockResolvedValue(undefined),
        tellerApplicationId: null,
        tellerEnvironment: 'development',
      })
    );

    await act(async () => {
      await result.current.connect?.('setup-token');
    });

    expect(simpleFinServiceMock.connectAndSyncAll).toHaveBeenCalledWith('setup-token');
  });

  it('marks the flow connected immediately after a successful SimpleFIN connect', async () => {
    simpleFinServiceMock.getStatus.mockResolvedValue([]);

    const dispatch = jest.fn();
    const { result } = renderHook(() =>
      useSimpleFinConnectionStrategy({
        isOnline: true,
        sdkNonce: 0,
        setSdkNonce: jest.fn(),
        sdkFailedRef: { current: false },
        state: initialFinancialConnectionState,
        dispatch,
        handleError: jest.fn(),
        onConnectionSuccess: jest.fn(),
        invalidateCache: jest.fn().mockResolvedValue(undefined),
        tellerApplicationId: null,
        tellerEnvironment: 'development',
      })
    );

    await act(async () => {
      await result.current.connect?.('setup-token');
    });

    expect(dispatch).toHaveBeenCalledWith(
      connectionActions.patch({
        isConnected: true,
        institutionName: 'SimpleFIN',
        error: null,
      })
    );
  });
});
