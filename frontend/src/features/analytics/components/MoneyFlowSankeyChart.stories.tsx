import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor, within } from 'storybook/test';
import {
  sampleSankeyAccentIndexByName,
  sampleSankeyDeficit,
  sampleSankeyEmpty,
  sampleSankeyNoIncome,
  sampleSankeySurplus,
} from '@/storybook/fixtures/analytics';
import type { SankeyResponse } from '@/types/api';
import { MoneyFlowSankeyChart } from './MoneyFlowSankeyChart';

function MoneyFlowSankeyChartStory(props: {
  data: SankeyResponse;
  accentIndexByName: ReadonlyMap<string, number>;
}) {
  return <MoneyFlowSankeyChart data={props.data} accentIndexByName={props.accentIndexByName} />;
}

const meta = {
  title: 'Features/Analytics/MoneyFlowSankeyChart',
  component: MoneyFlowSankeyChartStory,
  tags: ['autodocs', 'test'],
  decorators: [
    (Story) => (
      <div className="h-[360px] w-[760px]">
        <Story />
      </div>
    ),
  ],
  args: {
    accentIndexByName: sampleSankeyAccentIndexByName,
  },
} satisfies Meta<typeof MoneyFlowSankeyChartStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Deficit: Story = {
  args: {
    data: sampleSankeyDeficit,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByTestId('sankey-node-debt')).toBeVisible();
    });
    expect(canvas.getByText('Debt')).toBeVisible();
    expect(canvas.queryByText('Surplus')).not.toBeInTheDocument();
  },
};

export const Surplus: Story = {
  args: {
    data: sampleSankeySurplus,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByTestId('sankey-node-surplus')).toBeVisible();
    });
    expect(canvas.queryByText('Debt')).not.toBeInTheDocument();
  },
};

export const NoIncome: Story = {
  args: {
    data: sampleSankeyNoIncome,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByTestId('sankey-node-debt')).toBeVisible();
    });
    expect(canvas.getByText('Debt')).toBeVisible();
    expect(canvas.queryByText('Surplus')).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: {
    data: sampleSankeyEmpty,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText('No money flow yet')).toBeVisible();
    });
    expect(canvas.getByText('No category spending was found for this range.')).toBeVisible();
  },
};
