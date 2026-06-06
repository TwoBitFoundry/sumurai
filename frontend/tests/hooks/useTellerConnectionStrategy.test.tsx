import { renderHook } from '@testing-library/react';
import { initialFinancialConnectionState } from '@/hooks/financialConnection/connectionState';
import { useTellerConnectionStrategy } from '@/hooks/financialConnection/useTellerConnectionStrategy';

jest.mock('@/features/teller/components/TellerConnectSdk', () => ({
  TellerConnectSdk: jest.fn(() => null),
}));

jest.mock('@/services/TellerService', () => ({
  TellerService: {
    getStatus: jest.fn().mockResolvedValue([]),
    syncTransactions: jest.fn(),
  },
}));

describe('useTellerConnectionStrategy', () => {
  it('does not update readiness while rendering without a teller application id', () => {
    const setReady = jest.fn();

    const { result } = renderHook(() =>
      useTellerConnectionStrategy({
        isOnline: true,
        sdkNonce: 0,
        setSdkNonce: jest.fn(),
        setReady,
        sdkFailedRef: { current: false },
        state: initialFinancialConnectionState,
        dispatch: jest.fn(),
        handleError: jest.fn(),
        onConnectionSuccess: jest.fn(),
        onSimpleFinAuthRequired: jest.fn(),
        invalidateCache: jest.fn().mockResolvedValue(undefined),
        tellerApplicationId: null,
        tellerEnvironment: 'development',
      })
    );

    setReady.mockClear();

    expect(result.current.render()).toBeNull();
    expect(setReady).not.toHaveBeenCalled();
  });
});
