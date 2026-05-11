import { act, renderHook } from '@testing-library/react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const setOnlineState = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
};

describe('useOnlineStatus', () => {
  beforeEach(() => {
    setOnlineState(true);
  });

  it('reads the browser online state on mount', () => {
    setOnlineState(false);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
  });

  it('updates when the browser goes offline and back online', () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);

    act(() => {
      setOnlineState(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);

    act(() => {
      setOnlineState(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });
});
