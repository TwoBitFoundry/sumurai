import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { BottomContextualBar } from '@/components/BottomContextualBar';
import {
  BudgetMonthLabelPill,
  BudgetMonthPillSlider,
} from '@/features/budgets/components/BudgetMonthPillSlider';
import { useBudgetMonth } from '@/features/budgets/hooks/useBudgetMonth';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import { sampleFixedExpenses } from '@/storybook/fixtures/fixed-expenses';
import BudgetsPage from '@/views/BudgetsPage';
import {
  getCursorStoryTransactions,
  storyBudgetRecords,
  storyCategoryList,
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

async function expandBudgetInsights(canvas: ReturnType<typeof within>) {
  const summaryButton = canvas.getByRole('button', { name: /budget insights/i });
  if (summaryButton.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(summaryButton);
  }
  await waitFor(() => {
    expect(canvas.getByText('Fixed Costs')).toBeVisible();
  });
}

let storyBudgets = storyBudgetRecords.map((budget) => ({ ...budget }));

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/budgets/overview', () =>
    jsonResponse({
      budgets: storyBudgets,
      fixed_expenses: sampleFixedExpenses,
    })
  ),
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
  route('GET', '/categories', () => jsonResponse(storyCategoryList)),
  route('GET', '/transactions/categories', () => jsonResponse(storyTransactionCategories)),
  route('GET', '/transactions', (request) =>
    jsonResponse(
      getCursorStoryTransactions({
        cursor: request.query.get('cursor'),
        limit: Number(request.query.get('limit') ?? '100'),
        search: request.query.get('search'),
        categoryPrimary: request.query.get('category_primary'),
      })
    )
  ),
];

function BudgetsJourney() {
  const monthControl = useBudgetMonth();
  storyBudgets = storyBudgetRecords.map((budget) => ({ ...budget }));
  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <BudgetsPage monthControl={monthControl} />
        <BottomContextualBar
          topContent={<BudgetMonthLabelPill monthLabel={monthControl.monthLabel} />}
        >
          <BudgetMonthPillSlider
            onPreviousMonth={monthControl.goToPreviousMonth}
            onNextMonth={monthControl.goToNextMonth}
            onCurrentMonth={monthControl.goToCurrentMonth}
          />
        </BottomContextualBar>
      </StoryApiScope>
    </AccountFilterStoryProvider>
  );
}

export const Journey: Story = {
  render: () => <BudgetsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/provision the coffers/i)).toBeVisible();
    });
    await expandBudgetInsights(canvas);

    await userEvent.click(canvas.getByRole('button', { name: /show budgets/i }));
    const addBudget = canvas.getByRole('button', { name: /^budget$/i });
    await userEvent.click(addBudget);
    const picker = await screen.findByTestId('add-budget-picker-content');
    await userEvent.click(within(picker).getByRole('button', { name: /bills and utilities/i }));
    await userEvent.type(screen.getByTestId('budget-amount-input'), '275');
    await userEvent.click(screen.getByRole('button', { name: 'Save budget' }));
    await waitFor(() => {
      expect(canvas.getAllByText(/bills and utilities/i)).toHaveLength(1);
    });

    await userEvent.click(canvas.getByRole('button', { name: /show fixed expenses/i }));
    await waitFor(() => {
      expect(canvas.getByText('CenturyLink')).toBeVisible();
      expect(canvas.getByText('Spotify')).toBeVisible();
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
  },
};
