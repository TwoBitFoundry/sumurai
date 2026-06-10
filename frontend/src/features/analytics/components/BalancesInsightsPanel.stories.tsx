import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { Totals } from '@/types/analytics';
import { BalancesInsightsPanel } from './BalancesInsightsPanel';

const sampleOverall: Totals = {
  cash: 123642.1,
  credit: -4713.4,
  loan: 0,
  investments: 0,
  positivesTotal: 123642.1,
  negativesTotal: -4713.4,
  net: 118928.7,
  ratio: null,
};

const meta = {
  title: 'Features/Analytics/BalancesInsightsPanel',
  component: BalancesInsightsPanel,
  tags: ['autodocs', 'test'],
  args: {
    overall: sampleOverall,
    resetKey: 'story',
  },
} satisfies Meta<typeof BalancesInsightsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Net')).toBeVisible();
    await expect(canvas.getByText('Cash')).toBeVisible();
    await expect(canvas.getByText('Investments')).toBeVisible();
    await expect(canvas.getByText('Credit')).toBeVisible();
    await expect(canvas.getByText('Loans')).toBeVisible();
  },
};

export const CollapseAndExpand: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const summaryButton = canvas.getByRole('button', { name: /net worth summary/i });
    await expect(summaryButton).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(summaryButton);
    await expect(summaryButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(summaryButton);
    await expect(canvas.getByText('Cash')).toBeVisible();
  },
};

export const FlipCategory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cashButton = canvas.getByRole('button', { name: /cash/i });
    await userEvent.click(cashButton);
    await expect(cashButton).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByTestId('insight-question')).toBeVisible();
  },
};
