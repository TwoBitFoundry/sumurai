import { act, renderHook } from '@testing-library/react';
import { useFloatingChromeFooterVisibility } from '@/hooks/useFloatingChromeFooterVisibility';

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  target: Element | null;
};

const observers: ObserverRecord[] = [];

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  target: Element | null = null;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    observers.push(this);
  }

  observe(target: Element) {
    this.target = target;
  }

  unobserve() {
    this.target = null;
  }

  disconnect() {
    this.target = null;
  }
}

function emitIntersection(isIntersecting: boolean) {
  for (const observer of observers) {
    if (!observer.target) continue;
    observer.callback(
      [
        {
          isIntersecting,
          target: observer.target,
          intersectionRatio: isIntersecting ? 1 : 0,
        } as IntersectionObserverEntry,
      ],
      observer as unknown as IntersectionObserver
    );
  }
}

function mockChromeElement(top: number) {
  const chrome = document.createElement('div');
  chrome.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + 100,
      left: 0,
      right: 0,
      width: 0,
      height: 100,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  return chrome;
}

function activeObserver() {
  return observers.filter((observer) => observer.target).at(-1);
}

describe('useFloatingChromeFooterVisibility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    observers.length = 0;
    (globalThis as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    });
    (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps floating chrome visible when footer tracking is disabled', () => {
    const { result } = renderHook(() => useFloatingChromeFooterVisibility(false));

    expect(result.current.floatingVisible).toBe(true);
    expect(observers).toHaveLength(0);
  });

  it('observes the sentinel with pixel root margin derived from chrome height', () => {
    const sentinel = document.createElement('span');
    const chrome = mockChromeElement(660);
    const { result } = renderHook(() => useFloatingChromeFooterVisibility(true));

    act(() => {
      result.current.floatingChromeRef(chrome);
      result.current.footerSentinelRef(sentinel);
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(activeObserver()?.options?.rootMargin).toBe('0px 0px -140px 0px');
    expect(activeObserver()?.target).toBe(sentinel);
  });

  it('hides floating chrome when the sentinel intersects the adjusted viewport', () => {
    const sentinel = document.createElement('span');
    const chrome = mockChromeElement(708);
    const { result } = renderHook(() => useFloatingChromeFooterVisibility(true));

    act(() => {
      result.current.floatingChromeRef(chrome);
      result.current.footerSentinelRef(sentinel);
      jest.advanceTimersByTime(300);
    });

    act(() => {
      emitIntersection(true);
      jest.advanceTimersByTime(120);
    });

    expect(result.current.floatingVisible).toBe(false);

    act(() => {
      emitIntersection(false);
      jest.advanceTimersByTime(120);
    });

    expect(result.current.floatingVisible).toBe(true);
  });

  it('re-attaches when footer tracking is enabled after being disabled', () => {
    const sentinel = document.createElement('span');
    const chrome = mockChromeElement(708);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useFloatingChromeFooterVisibility(enabled),
      { initialProps: { enabled: false } }
    );

    expect(observers).toHaveLength(0);

    rerender({ enabled: true });

    act(() => {
      result.current.floatingChromeRef(chrome);
      result.current.footerSentinelRef(sentinel);
      jest.advanceTimersByTime(300);
    });

    expect(activeObserver()?.target).toBe(sentinel);
  });
});
