import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { act, render } from '@testing-library/react';
import {
  SankeyAnimationProvider,
  useSankeyNodeScalar,
} from '@/features/analytics/hooks/useSankeyLayoutAnimation';

function ScalarProbe({ target }: { target: number }) {
  const value = useSankeyNodeScalar('income', 'x', target);
  return <span data-testid="scalar">{value}</span>;
}

function Harness({ target }: { target: number }) {
  return (
    <SankeyAnimationProvider>
      <ScalarProbe target={target} />
    </SankeyAnimationProvider>
  );
}

describe('SankeyAnimationProvider', () => {
  let rafSpy: ReturnType<typeof spyOn>;
  let nowSpy: ReturnType<typeof spyOn>;
  let clock = 1_000;
  const rafCallbacks: FrameRequestCallback[] = [];

  afterEach(() => {
    rafSpy.mockRestore();
    nowSpy.mockRestore();
    rafCallbacks.length = 0;
    clock = 1_000;
  });

  it('interpolates on every target change', async () => {
    rafSpy = spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    nowSpy = spyOn(performance, 'now').mockImplementation(() => clock);

    const { getByTestId, rerender } = render(<Harness target={0} />);

    expect(getByTestId('scalar').textContent).toBe('0');

    rerender(<Harness target={100} />);

    expect(getByTestId('scalar').textContent).toBe('0');

    await act(async () => {
      clock = 1_400;
      rafCallbacks.at(-1)?.(clock);
    });

    const midValue = Number(getByTestId('scalar').textContent);
    expect(midValue).toBeGreaterThan(0);
    expect(midValue).toBeLessThan(100);

    rerender(<Harness target={220} />);

    await act(async () => {
      clock = 1_800;
      rafCallbacks.at(-1)?.(clock);
    });

    const secondMidValue = Number(getByTestId('scalar').textContent);
    expect(secondMidValue).toBeGreaterThan(100);
    expect(secondMidValue).toBeLessThan(220);
  });
});
