import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { RangeSlider } from '@/ui/primitives';

describe('RangeSlider', () => {
  it('updates each thumb independently before the values meet', () => {
    const onValueChange = jest.fn();

    function Wrapper() {
      const [value, setValue] = React.useState<[number, number]>([8, 18]);

      return (
        <RangeSlider
          min={0}
          max={30}
          value={value}
          onValueChange={(nextValue) => {
            onValueChange(nextValue);
            setValue(nextValue);
          }}
          startAriaLabel="Start slider"
          endAriaLabel="End slider"
        />
      );
    }

    render(<Wrapper />);

    const startThumb = screen.getByRole('slider', { name: 'Start slider' });
    startThumb.focus();
    for (let index = 0; index < 4; index += 1) {
      fireEvent.keyDown(startThumb, { key: 'ArrowRight' });
    }
    expect(onValueChange).toHaveBeenLastCalledWith([12, 18]);

    const endThumb = screen.getByRole('slider', { name: 'End slider' });
    endThumb.focus();
    for (let index = 0; index < 3; index += 1) {
      fireEvent.keyDown(endThumb, { key: 'ArrowLeft' });
    }
    expect(onValueChange).toHaveBeenLastCalledWith([12, 15]);
  });

  it('commits the latest keyboard-adjusted values for each thumb independently', () => {
    const onValueChange = jest.fn();
    const onValueChangeCommitted = jest.fn();

    function Wrapper() {
      const [value, setValue] = React.useState<[number, number]>([8, 18]);

      return (
        <RangeSlider
          min={0}
          max={30}
          value={value}
          onValueChange={(nextValue) => {
            onValueChange(nextValue);
            setValue(nextValue);
          }}
          onValueChangeCommitted={onValueChangeCommitted}
          startAriaLabel="Start slider"
          endAriaLabel="End slider"
        />
      );
    }

    render(<Wrapper />);

    const startThumb = screen.getByRole('slider', { name: 'Start slider' });
    startThumb.focus();
    for (let index = 0; index < 4; index += 1) {
      fireEvent.keyDown(startThumb, { key: 'ArrowRight' });
    }
    expect(onValueChangeCommitted).toHaveBeenLastCalledWith([12, 18]);

    const endThumb = screen.getByRole('slider', { name: 'End slider' });
    endThumb.focus();
    for (let index = 0; index < 6; index += 1) {
      fireEvent.keyDown(endThumb, { key: 'ArrowRight' });
    }
    expect(onValueChangeCommitted).toHaveBeenLastCalledWith([12, 24]);
  });

  it('moves only the focused thumb', () => {
    function Wrapper() {
      const [value, setValue] = React.useState<[number, number]>([5, 25]);

      return (
        <RangeSlider
          min={0}
          max={30}
          value={value}
          onValueChange={setValue}
          onValueChangeCommitted={setValue}
          startAriaLabel="Start slider"
          endAriaLabel="End slider"
        />
      );
    }

    render(<Wrapper />);

    const startThumb = screen.getByRole('slider', { name: 'Start slider' });
    const endThumb = screen.getByRole('slider', { name: 'End slider' });

    expect(startThumb.getAttribute('aria-valuenow')).toBe('5');
    expect(endThumb.getAttribute('aria-valuenow')).toBe('25');

    startThumb.focus();
    for (let index = 0; index < 4; index += 1) {
      fireEvent.keyDown(startThumb, { key: 'ArrowRight' });
    }

    expect(startThumb.getAttribute('aria-valuenow')).toBe('9');
    expect(endThumb.getAttribute('aria-valuenow')).toBe('25');
  });

  it('respects the configured minimum spacing between thumbs', () => {
    function Wrapper() {
      const [value, setValue] = React.useState<[number, number]>([8, 18]);

      return (
        <RangeSlider
          min={0}
          max={30}
          value={value}
          minStepsBetweenThumbs={2}
          onValueChange={setValue}
          onValueChangeCommitted={setValue}
          startAriaLabel="Start slider"
          endAriaLabel="End slider"
        />
      );
    }

    render(<Wrapper />);

    const startThumb = screen.getByRole('slider', { name: 'Start slider' });
    startThumb.focus();
    for (let index = 0; index < 20; index += 1) {
      fireEvent.keyDown(startThumb, { key: 'ArrowRight' });
    }

    expect(startThumb.getAttribute('aria-valuenow')).toBe('16');
    expect(screen.getByRole('slider', { name: 'End slider' }).getAttribute('aria-valuenow')).toBe(
      '18'
    );
  });
});
