import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fireEvent, userEvent, within } from 'storybook/test';
import { RangeSlider } from './RangeSlider';

function RangeSliderStory() {
  const [value, setValue] = useState<[number, number]>([4, 18]);

  return (
    <div className="w-full max-w-md p-6">
      <RangeSlider
        min={0}
        max={30}
        value={value}
        onValueChange={setValue}
        startAriaLabel="Start slider"
        endAriaLabel="End slider"
      />
      <div data-testid="range-slider-value" className="mt-4 text-sm">
        {value[0]}-{value[1]}
      </div>
    </div>
  );
}

const meta = {
  title: 'Primitives/RangeSlider',
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <RangeSliderStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const startThumb = canvas.getByRole('slider', { name: 'Start slider' });
    const endThumb = canvas.getByRole('slider', { name: 'End slider' });

    startThumb.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByTestId('range-slider-value')).toHaveTextContent('5-18');

    fireEvent.change(endThumb, { target: { value: '22' } });
    await expect(canvas.getByTestId('range-slider-value')).toHaveTextContent('5-22');
  },
};
