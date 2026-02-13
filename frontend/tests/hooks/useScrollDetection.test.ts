import { act, renderHook } from '@testing-library/react';
import { useScrollDetection } from '@/hooks/useScrollDetection';

describe('useScrollDetection', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns false when window is not scrolled', () => {
      const { result } = renderHook(() => useScrollDetection());
      expect(result.current).toBe(false);
    });

    it('returns true when window is already scrolled', () => {
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        value: 100,
      });
      const { result } = renderHook(() => useScrollDetection());
      expect(result.current).toBe(true);
    });
  });

  describe('scroll event handling', () => {
    it('returns true when window scrolls down', () => {
      const { result } = renderHook(() => useScrollDetection());
      expect(result.current).toBe(false);

      act(() => {
        Object.defineProperty(window, 'scrollY', {
          configurable: true,
          value: 100,
        });
        window.dispatchEvent(new Event('scroll'));
      });

      expect(result.current).toBe(true);
    });

    it('returns false when window scrolls back to top', () => {
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        value: 100,
      });
      const { result } = renderHook(() => useScrollDetection());
      expect(result.current).toBe(true);

      act(() => {
        Object.defineProperty(window, 'scrollY', {
          configurable: true,
          value: 0,
        });
        window.dispatchEvent(new Event('scroll'));
      });

      expect(result.current).toBe(false);
    });
  });

  describe('event listener cleanup', () => {
    it('removes event listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useScrollDetection());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('uses passive event listener for performance', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      renderHook(() => useScrollDetection());

      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), {
        passive: true,
      });
      addEventListenerSpy.mockRestore();
    });
  });
});
