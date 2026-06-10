import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { ContextualInsightsResponse } from '@/types/api';
import { TransactionInsightsPanel } from './TransactionInsightsPanel';

function metric(
  value: number | null,
  format: ContextualInsightsResponse['card1']['format'],
  secondary: number | null = null,
  comparison: number | null = null,
  share: number | null = null
): ContextualInsightsResponse['card1'] {
  return { value, format, secondary, comparison, share, label: null };
}

const stateA: ContextualInsightsResponse = {
  state: 'a',
  card1: metric(1840.5, 'currency', 22),
  card2: metric(48.0, 'currency'),
  card3: metric(3, 'count', 19),
};

const stateB: ContextualInsightsResponse = {
  state: 'b',
  card1: { ...metric(620.0, 'currency', 8), share: 0.34 },
  card2: metric(55.0, 'currency'),
  card3: metric(1.4, 'ratio', null, 39.0),
};

const stateC: ContextualInsightsResponse = {
  state: 'c',
  card1: metric(980.0, 'currency', 14),
  card2: metric(62.5, 'currency'),
  card3: metric(1.8, 'ratio', null, 34.0),
};

const stateD: ContextualInsightsResponse = {
  state: 'd',
  card1: { ...metric(740.0, 'currency', 11), share: 0.41 },
  card2: metric(52.0, 'currency'),
  card3: metric(1.1, 'ratio', null, 48.0),
};

const stateE: ContextualInsightsResponse = {
  state: 'e',
  card1: metric(310.0, 'currency', 5),
  card2: metric(44.0, 'currency'),
  card3: metric(0.5, 'percent', 620.0),
};

const stateF: ContextualInsightsResponse = {
  state: 'f',
  card1: metric(200.0, 'currency', 3),
  card2: metric(62.5, 'currency'),
  card3: metric(0.6, 'percent'),
};

const stateG: ContextualInsightsResponse = {
  state: 'g',
  card1: { ...metric(480.0, 'currency', 7), share: 0.21 },
  card2: metric(60.0, 'currency'),
  card3: metric(1.5, 'ratio', null, 32.0),
};

const stateTriple: ContextualInsightsResponse = {
  state: 'triple',
  card1: metric(155.0, 'currency', 2),
  card2: metric(75.0, 'currency'),
  card3: metric(14, 'days'),
};

const meta = {
  title: 'Features/Transactions/TransactionInsightsPanel',
  component: TransactionInsightsPanel,
  tags: ['autodocs', 'test'],
  args: {
    insights: stateA,
    isLoading: false,
    resetKey: 'story',
  },
} satisfies Meta<typeof TransactionInsightsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StateA: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('All transactions')).toBeVisible();
    await expect(canvas.getByText('Volume')).toBeVisible();
    await expect(canvas.getByText('Typical')).toBeVisible();
    await expect(canvas.getByText('Breakdown')).toBeVisible();
  },
};

export const StateB: Story = {
  args: { insights: stateB, resetKey: 'b' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Category filter')).toBeVisible();
    await expect(canvas.getByText('Category Total')).toBeVisible();
    await expect(canvas.getByText('vs Your Usual')).toBeVisible();
  },
};

export const StateC: Story = {
  args: { insights: stateC, resetKey: 'c' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Merchant view')).toBeVisible();
    await expect(canvas.getByText('Lifetime Spend')).toBeVisible();
    await expect(canvas.getByText('vs Category')).toBeVisible();
  },
};

export const StateD: Story = {
  args: { insights: stateD, resetKey: 'd' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This account')).toBeVisible();
    await expect(canvas.getByText('Account Total')).toBeVisible();
  },
};

export const StateE: Story = {
  args: { insights: stateE, resetKey: 'e' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Account + Category')).toBeVisible();
    await expect(canvas.getByText('Share of Wallet')).toBeVisible();
    await expect(canvas.getByText('50.0%')).toBeVisible();
  },
};

export const StateF: Story = {
  args: { insights: stateF, resetKey: 'f' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Account + Merchant')).toBeVisible();
    await expect(canvas.getByText('Swipe Preference')).toBeVisible();
    await expect(canvas.getByText('60.0%')).toBeVisible();
  },
};

export const StateG: Story = {
  args: { insights: stateG, resetKey: 'g' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Category + Merchant')).toBeVisible();
    await expect(canvas.getByText('Merchant Total')).toBeVisible();
  },
};

export const StateTriple: Story = {
  args: { insights: stateTriple, resetKey: 'triple' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Full filter')).toBeVisible();
    await expect(canvas.getByText('Last Visit')).toBeVisible();
    await expect(canvas.getByText('14 days')).toBeVisible();
  },
};

export const FlipAndReset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole('button', { name: /volume/i });
    await userEvent.click(btn);
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => {
      expect(canvas.getByTestId('insight-question')).toBeVisible();
    });
  },
};

export const Loading: Story = {
  args: { insights: null, isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading…')).toBeVisible();
  },
};

export const NoCard3: Story = {
  args: {
    insights: { ...stateA, card3: null },
    resetKey: 'no-card3',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Breakdown')).not.toBeInTheDocument();
    await expect(canvas.getByText('Volume')).toBeVisible();
    await expect(canvas.getByText('Typical')).toBeVisible();
  },
};
