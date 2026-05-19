import { act, renderHook } from '@testing-library/react';
import {
  CHART_RECALC_DEBOUNCE_MS,
  useDebouncedChartRecalc,
} from '@/features/analytics/hooks/useDebouncedChartRecalc';

describe('useDebouncedChartRecalc', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exposes a chart recalc debounce delay', () => {
    expect(CHART_RECALC_DEBOUNCE_MS).toBeGreaterThanOrEqual(200);
  });

  it('updates the debounced value after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedChartRecalc(value), {
      initialProps: { value: [1] },
    });

    expect(result.current).toEqual([1]);

    rerender({ value: [1, 2] });
    expect(result.current).toEqual([1]);

    act(() => {
      jest.advanceTimersByTime(CHART_RECALC_DEBOUNCE_MS);
    });

    expect(result.current).toEqual([1, 2]);
  });
});
