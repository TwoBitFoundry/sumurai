import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, waitFor, within } from 'storybook/test';
import type { DonutDatum } from '@/features/analytics/adapters/chartData';
import { sampleDonutByCategory, sampleDonutTotal } from '@/storybook/fixtures/analytics';
import { fmtUSD } from '@/utils/format';
import { SpendingByCategoryChart } from './SpendingByCategoryChart';

function SpendingByCategoryChartStory(props: { data: DonutDatum[]; total: number }) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  return (
    <SpendingByCategoryChart
      data={props.data}
      total={props.total}
      hoveredCategory={hoveredCategory}
      setHoveredCategory={setHoveredCategory}
    />
  );
}

const meta = {
  title: 'Features/Analytics/SpendingByCategoryChart',
  component: SpendingByCategoryChartStory,
  tags: ['autodocs', 'test'],
  decorators: [
    (Story) => (
      <div className="h-[280px] w-[320px]">
        <Story />
      </div>
    ),
  ],
  args: {
    data: sampleDonutByCategory,
    total: sampleDonutTotal,
  },
} satisfies Meta<typeof SpendingByCategoryChartStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => {
        expect(canvas.getByText(fmtUSD(args.total))).toBeVisible();
      },
      { timeout: 3000 }
    );
  },
};

export const Empty: Story = {
  args: {
    data: [],
    total: 0,
  },
};
