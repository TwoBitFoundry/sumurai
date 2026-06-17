import { renderHook } from '@testing-library/react';
import { connectionProviders } from '@/hooks/financialConnection/connectionProviders';
import { initialFinancialConnectionState } from '@/hooks/financialConnection/connectionState';

describe('useDiyConnectionStrategy', () => {
  it('registers a ready no-op DIY strategy', () => {
    const { result } = renderHook(() =>
      connectionProviders.diy.useStrategy({
        isOnline: true,
        sdkNonce: 0,
        setSdkNonce: jest.fn(),
        setReady: jest.fn(),
        sdkFailedRef: { current: false },
        state: initialFinancialConnectionState,
        dispatch: jest.fn(),
        handleError: jest.fn(),
        invalidateCache: jest.fn().mockResolvedValue(undefined),
        tellerApplicationId: null,
        tellerEnvironment: 'development',
      })
    );

    expect(connectionProviders.diy.provider).toBe('diy');
    expect(result.current.getReady()).toBe(true);
    expect(result.current.render()).toBeNull();
    expect(result.current.loadFailedMessage).toBe('');
  });
});
