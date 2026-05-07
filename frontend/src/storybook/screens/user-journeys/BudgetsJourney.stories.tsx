import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountFilterProvider } from '@/hooks/useAccountFilter';
import BudgetsPage from '@/views/BudgetsPage';
import { jsonResponse, route, StoryApiScope } from './storyApi';
import { storyBudgetRecords, storyProviderAccounts, storyTransactions } from './shared';

const meta = {
  title: 'App/Screens/User Journeys/Budgets',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/budgets', () => jsonResponse(storyBudgetRecords)),
  route('POST', '/budgets', ({ body }) => {
    const payload = body as { category?: string; amount?: string };
    return jsonResponse({
      id: `story-budget-${storyBudgetRecords.length + 1}`,
      category: payload.category ?? 'other',
      amount: payload.amount ?? '0',
    });
  }),
  route('PUT', '/budgets/story-budget-1', ({ body }) => {
    const payload = body as { amount?: string };
    return jsonResponse({
      id: 'story-budget-1',
      category: 'food_and_drink',
      amount: payload.amount ?? '0',
    });
  }),
  route('DELETE', '/budgets/story-budget-1', () => jsonResponse({}, { status: 204 })),
  route('GET', '/transactions', () => jsonResponse(storyTransactions)),
];

function BudgetsJourney() {
  return (
    <StoryApiScope handlers={handlers}>
      <AccountFilterProvider>
        <BudgetsPage />
      </AccountFilterProvider>
    </StoryApiScope>
  );
}

export const Journey: Story = {
  render: () => <BudgetsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/budgets at a glance/i)).toBeVisible();
    });
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /next month/i })).toBeVisible();
    });

    const nextMonth = canvas.getByRole('button', { name: /next month/i });
    await userEvent.click(nextMonth);
    const expectedMonth = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
    await expect(canvas.getByText(expectedMonth)).toBeVisible();

    const addBudget = canvas.getByRole('button', { name: /add budget/i });
    await userEvent.click(addBudget);
    await userEvent.selectOptions(canvas.getByTestId('budget-category-select'), 'bills_and_utilities');
    await userEvent.type(canvas.getByTestId('budget-amount-input'), '275');
    await userEvent.click(canvas.getByTestId('budget-save'));
    await waitFor(() => {
      expect(canvas.getAllByText(/bills and utilities/i)).toHaveLength(2);
    });
  },
};
