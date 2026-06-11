import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Totals } from '@/types/analytics';
import { BalancesInsightsPanel } from './BalancesInsightsPanel';

const collapsibleSessionKey = 'sumurai.ui.collapsibleExpanded';
const balancesInsightsSectionId = 'balances-insights';

function clearBalancesInsightsSession() {
  const raw = window.sessionStorage.getItem(collapsibleSessionKey);
  if (!raw) {
    return;
  }
  try {
    const map = JSON.parse(raw) as Record<string, boolean>;
    delete map[balancesInsightsSectionId];
    if (Object.keys(map).length === 0) {
      window.sessionStorage.removeItem(collapsibleSessionKey);
      return;
    }
    window.sessionStorage.setItem(collapsibleSessionKey, JSON.stringify(map));
  } catch {
    window.sessionStorage.removeItem(collapsibleSessionKey);
  }
}

async function expandBalancesInsights(canvas: ReturnType<typeof within>) {
  const summaryButton = canvas.getByRole('button', { name: /balances now/i });
  if (summaryButton.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(summaryButton);
  }
  await waitFor(() => {
    expect(canvas.getByTestId('overall-cash')).toBeVisible();
  });
}

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
  decorators: [
    (Story) => {
      clearBalancesInsightsSession();
      return <Story />;
    },
  ],
  args: {
    overall: sampleOverall,
    resetKey: 'story',
  },
} satisfies Meta<typeof BalancesInsightsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CollapsedByDefault: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const summaryButton = canvas.getByRole('button', { name: /balances now/i });
    await expect(canvas.getByText('Net')).toBeVisible();
    await expect(summaryButton).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByText('Cash')).not.toBeInTheDocument();
  },
};

export const CollapseAndExpand: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const summaryButton = canvas.getByRole('button', { name: /balances now/i });
    await expect(summaryButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(summaryButton);
    await waitFor(() => {
      expect(summaryButton).toHaveAttribute('aria-expanded', 'true');
      expect(canvas.getByTestId('overall-cash')).toBeVisible();
    });
    await userEvent.click(summaryButton);
    await expect(summaryButton).toHaveAttribute('aria-expanded', 'false');
  },
};

export const FlipCategory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandBalancesInsights(canvas);
    const cashButton = canvas.getByRole('button', { name: /cash/i });
    await userEvent.click(cashButton);
    await waitFor(() => {
      expect(cashButton).toHaveAttribute('aria-expanded', 'true');
      expect(canvas.getByTestId('insight-question')).toBeVisible();
    });
  },
};
