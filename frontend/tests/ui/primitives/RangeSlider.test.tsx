import { fireEvent, render, screen } from '@testing-library/react';
import { RangeSlider } from '@/ui/primitives';

describe('RangeSlider', () => {
  it('emits clamped start and end values without letting the thumbs cross', () => {
    const onValueChange = jest.fn();

    render(
      <RangeSlider
        min={0}
        max={30}
        value={[8, 18]}
        onValueChange={onValueChange}
        startAriaLabel="Start slider"
        endAriaLabel="End slider"
      />
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Start slider' }), {
      target: { value: '22' },
    });
    expect(onValueChange).toHaveBeenLastCalledWith([18, 18]);

    fireEvent.change(screen.getByRole('slider', { name: 'End slider' }), {
      target: { value: '4' },
    });
    expect(onValueChange).toHaveBeenLastCalledWith([8, 8]);
  });
});
