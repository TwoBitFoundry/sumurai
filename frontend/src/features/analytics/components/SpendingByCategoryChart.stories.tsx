import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import type { DonutDatum } from '@/features/analytics/adapters/chartData';
import { sampleDonutByCategory, sampleDonutTotal } from '@/storybook/fixtures/analytics';
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
  args: {
    data: sampleDonutByCategory,
    total: sampleDonutTotal,
  },
} satisfies Meta<typeof SpendingByCategoryChartStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    data: [],
    total: 0,
  },
};
