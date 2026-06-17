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

const collapsibleSessionKey = 'sumurai.ui.collapsibleExpanded';
const transactionInsightsSectionId = 'transactions-insights';

function clearTransactionInsightsSession() {
  const raw = window.sessionStorage.getItem(collapsibleSessionKey);
  if (!raw) {
    return;
  }
  try {
    const map = JSON.parse(raw) as Record<string, boolean>;
    delete map[transactionInsightsSectionId];
    if (Object.keys(map).length === 0) {
      window.sessionStorage.removeItem(collapsibleSessionKey);
      return;
    }
    window.sessionStorage.setItem(collapsibleSessionKey, JSON.stringify(map));
  } catch {
    window.sessionStorage.removeItem(collapsibleSessionKey);
  }
}

async function expandTransactionInsights(canvas: ReturnType<typeof within>) {
  const summaryButton = canvas.getByRole('button', {
    name: /expand transaction insights|collapse transaction insights/i,
  });
  if (summaryButton.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(summaryButton);
  }
  await waitFor(() => {
    expect(canvas.getByTestId('transaction-insights-panel-body')).toBeVisible();
  });
}

const meta = {
  title: 'Features/Transactions/TransactionInsightsPanel',
  component: TransactionInsightsPanel,
  tags: ['autodocs', 'test'],
  decorators: [
    (Story) => {
      clearTransactionInsightsSession();
      return <Story />;
    },
  ],
  args: {
    insights: stateA,
    displayState: 'a',
    isLoading: false,
    resetKey: 'story',
  },
  render: (args) => (
    <TransactionInsightsPanel
      {...args}
      displayState={args.displayState ?? args.insights?.state ?? 'a'}
    />
  ),
} satisfies Meta<typeof TransactionInsightsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StateA: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Transaction insights')).toBeVisible();
    await expandTransactionInsights(canvas);
    await expect(canvas.getByText('Volume')).toBeVisible();
    await expect(canvas.getByText('Typical')).toBeVisible();
    await expect(canvas.getByText('Breakdown')).toBeVisible();
  },
};

export const StateB: Story = {
  args: { insights: stateB, displayState: 'b', resetKey: 'b' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Category insights')).toBeVisible();
    await expandTransactionInsights(canvas);
    await expect(canvas.getByText('Category Total')).toBeVisible();
    await expect(canvas.getByText('vs All Categories')).toBeVisible();
  },
};

export const StateC: Story = {
  args: { insights: stateC, displayState: 'c', resetKey: 'c' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Merchant insights')).toBeVisible();
    await expandTransactionInsights(canvas);
    await expect(canvas.getByText('Lifetime Spend')).toBeVisible();
    await expect(canvas.getByText('vs Category')).toBeVisible();
  },
};

export const StateD: Story = {
  args: { insights: stateD, displayState: 'd', resetKey: 'd' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Account insights')).toBeVisible();
    await expandTransactionInsights(canvas);
    await expect(canvas.getByText('Account Total')).toBeVisible();
  },
};

export const StateE: Story = {
  args: { insights: stateE, displayState: 'e', resetKey: 'e' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Category + account insights')).toBeVisible();
    await expandTransactionInsights(canvas);
    await expect(canvas.getByText('Share of Wallet')).toBeVisible();
    await expect(canvas.getByText('50.0%')).toBeVisible();
  },
};

export const StateF: Story = {
  args: { insights: stateF, displayState: 'f', resetKey: 'f' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Merchant + account insights')).toBeVisible();
    await expandTransactionInsights(canvas);
    await expect(canvas.getByText('Swipe Preference')).toBeVisible();
    await expect(canvas.getByText('60.0%')).toBeVisible();
  },
};

export const StateG: Story = {
  args: { insights: stateG, displayState: 'g', resetKey: 'g' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Category + merchant insights')).toBeVisible();
    await expandTransactionInsights(canvas);
    await expect(canvas.getByText('Merchant Total')).toBeVisible();
  },
};

export const StateTriple: Story = {
  args: { insights: stateTriple, displayState: 'triple', resetKey: 'triple' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Category + merchant + account insights')).toBeVisible();
    await expandTransactionInsights(canvas);
    await expect(canvas.getByText('Last Visit')).toBeVisible();
    await expect(canvas.getByText('14 days')).toBeVisible();
  },
};

export const FlipAndReset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandTransactionInsights(canvas);
    const btn = canvas.getByRole('button', { name: /volume/i });
    await userEvent.click(btn);
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => {
      expect(canvas.getByTestId('insight-question')).toBeVisible();
      expect(canvas.getByText(/how much, across how many transactions/i)).toBeVisible();
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
    await expandTransactionInsights(canvas);
    await expect(canvas.queryByText('Breakdown')).not.toBeInTheDocument();
    await expect(canvas.getByText('Volume')).toBeVisible();
    await expect(canvas.getByText('Typical')).toBeVisible();
  },
};
