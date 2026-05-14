import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import BudgetsPage from '@/views/BudgetsPage';
import {
  getPagedStoryTransactions,
  storyBudgetRecords,
  storyProviderAccounts,
  storyTransactionCategories,
} from './shared';
import { jsonResponse, route, StoryApiScope } from './storyApi';

const meta = {
  title: 'App/Screens/User Journeys/Budgets',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

let storyBudgets = storyBudgetRecords.map((budget) => ({ ...budget }));

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/budgets', () => jsonResponse(storyBudgets)),
  route('POST', '/budgets', ({ body }) => {
    const payload = body as { category?: string; amount?: string };
    const created = {
      id: `story-budget-${storyBudgetRecords.length + 1}`,
      category: payload.category ?? 'other',
      amount: Number(payload.amount ?? '0'),
    };
    storyBudgets = [...storyBudgets, created];
    return jsonResponse(created);
  }),
  route('PUT', '/budgets/story-budget-1', ({ body }) => {
    const payload = body as { amount?: string };
    const updated = {
      id: 'story-budget-1',
      category: 'food_and_drink',
      amount: Number(payload.amount ?? '0'),
    };
    storyBudgets = storyBudgets.map((budget) => (budget.id === updated.id ? updated : budget));
    return jsonResponse(updated);
  }),
  route('DELETE', '/budgets/story-budget-1', () => {
    storyBudgets = storyBudgets.filter((budget) => budget.id !== 'story-budget-1');
    return jsonResponse({}, { status: 204 });
  }),
  route('GET', '/transactions/categories', () => jsonResponse(storyTransactionCategories)),
  route('GET', '/transactions', (request) =>
    jsonResponse(
      getPagedStoryTransactions({
        page: Number(request.query.get('page') ?? '1'),
        pageSize: Number(request.query.get('page_size') ?? '8'),
        search: request.query.get('search'),
        categoryPrimary: request.query.get('category_primary'),
      })
    )
  ),
];

function BudgetsJourney() {
  storyBudgets = storyBudgetRecords.map((budget) => ({ ...budget }));
  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <BudgetsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
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
    await userEvent.selectOptions(
      canvas.getByTestId('budget-category-select'),
      'bills_and_utilities'
    );
    await userEvent.type(canvas.getByTestId('budget-amount-input'), '275');
    await userEvent.click(canvas.getByTestId('budget-save'));
    await waitFor(() => {
      expect(canvas.getAllByText(/bills and utilities/i)).toHaveLength(2);
    });
  },
};
