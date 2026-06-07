import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BudgetInsightCard } from './BudgetInsightCard';

const meta = {
  title: 'Features/Budgets/BudgetInsightCard',
  component: BudgetInsightCard,
  tags: ['autodocs', 'test'],
  args: {
    title: 'Daily Pacing',
    value: '$15.00',
    suffix: '/ day',
    subtext: '20 days left',
    question: 'How much can I spend every day for the rest of the month without blowing my budget?',
    howToAct: 'Stay at or below this daily rate to end the month in the green.',
    accent: 'emerald',
    flipped: false,
    onToggle: fn(),
  },
} satisfies Meta<typeof BudgetInsightCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Front: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Daily Pacing')).toBeVisible();
    await expect(canvas.getByText('$15.00')).toBeVisible();
    await expect(canvas.queryByText(/how much can i spend/i)).not.toBeInTheDocument();
  },
};

export const Back: Story = {
  args: { flipped: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/how much can i spend every day/i)).toBeVisible();
    await expect(canvas.queryByText('$15.00')).not.toBeInTheDocument();
  },
};

export const FlipInteraction: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole('button', { name: /daily pacing/i });
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(btn);
    await expect(args.onToggle).toHaveBeenCalledTimes(1);
  },
};
