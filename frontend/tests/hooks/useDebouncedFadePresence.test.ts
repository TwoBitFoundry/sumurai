import { act, renderHook } from '@testing-library/react';
import { useDebouncedFadePresence } from '@/hooks/useDebouncedFadePresence';

describe('useDebouncedFadePresence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces fade in then fades out after hide delay', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string | null }) =>
        useDebouncedFadePresence(value, {
          showDelayMs: 50,
          hideDelayMs: 40,
          fadeDurationMs: 100,
        }),
      { initialProps: { value: null as string | null } }
    );

    expect(result.current.content).toBeNull();
    expect(result.current.visible).toBe(false);

    rerender({ value: 'alpha' });

    expect(result.current.content).toBe('alpha');
    expect(result.current.visible).toBe(false);

    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(result.current.visible).toBe(true);

    rerender({ value: null });

    act(() => {
      jest.advanceTimersByTime(40);
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.content).toBe('alpha');

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.content).toBeNull();
  });

  it('updates content without hiding when value changes while visible', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string | null }) =>
        useDebouncedFadePresence(value, { showDelayMs: 0, hideDelayMs: 40, fadeDurationMs: 100 }),
      { initialProps: { value: 'one' as string | null } }
    );

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.content).toBe('one');

    rerender({ value: 'two' });

    expect(result.current.visible).toBe(true);
    expect(result.current.content).toBe('two');
  });

  it('cancels hide when value returns before hide delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string | null }) =>
        useDebouncedFadePresence(value, { showDelayMs: 0, hideDelayMs: 80, fadeDurationMs: 100 }),
      { initialProps: { value: 'stay' as string | null } }
    );

    act(() => {
      jest.runAllTimers();
    });

    rerender({ value: null });

    act(() => {
      jest.advanceTimersByTime(40);
    });

    rerender({ value: 'stay' });

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.content).toBe('stay');
  });
});
