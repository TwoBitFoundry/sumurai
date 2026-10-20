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
import {
  getCursorStoryTransactions,
  storyBudgetRecords,
  storyCategoryList,
  storyProviderAccounts,
  storyTransactionCategories,
} from '@/storybook/support/shared';
import { createRequestLog, jsonResponse, route, StoryApiScope } from '@/storybook/support/storyApi';
import BudgetsPage from '@/views/BudgetsPage';

const meta = {
  title: 'App/Journeys/Budgets',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test', 'journey'],
  decorators: [
    (Story) => {
      storyBudgets = storyBudgetRecords.map((budget) => ({ ...budget }));
      requests.clear();
      return <Story />;
    },
  ],
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

async function openBudgetsSection(canvas: ReturnType<typeof within>) {
  await waitFor(() => {
    expect(canvas.getByText(/track your expenses/i)).toBeVisible();
  });
  await expandBudgetInsights(canvas);
  const showBudgets = canvas.queryByRole('button', { name: /show budgets/i });
  if (showBudgets) {
    await userEvent.click(showBudgets);
  }
}

let storyBudgets = storyBudgetRecords.map((budget) => ({ ...budget }));

const requests = createRequestLog();

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/budgets/overview', () =>
    jsonResponse({
      budgets: storyBudgets,
      fixed_expenses: sampleFixedExpenses,
    })
  ),
  requests.route('POST', '/budgets', ({ body }) => {
    const payload = body as { category?: string; amount?: string };
    const created = {
      id: `story-budget-${storyBudgetRecords.length + 1}`,
      category: payload.category ?? 'other',
      amount: Number(payload.amount ?? '0'),
    };
    storyBudgets = [...storyBudgets, created];
    return jsonResponse(created);
  }),
  requests.route('PUT', '/budgets/story-budget-1', ({ body }) => {
    const payload = body as { amount?: string };
    const updated = {
      id: 'story-budget-1',
      category: 'food_and_drink',
      amount: Number(payload.amount ?? '0'),
    };
    storyBudgets = storyBudgets.map((budget) => (budget.id === updated.id ? updated : budget));
    return jsonResponse(updated);
  }),
  requests.route('DELETE', '/budgets/story-budget-1', () => {
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

export const AddBudget: Story = {
  render: () => <BudgetsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await openBudgetsSection(canvas);

    await userEvent.click(canvas.getByRole('button', { name: /add budget/i }));
    const picker = await screen.findByTestId('add-budget-picker-content');
    await userEvent.click(within(picker).getByRole('button', { name: /bills and utilities/i }));
    await expect(body.getByRole('button', { name: 'Save budget' })).toBeDisabled();

    await userEvent.type(body.getByTestId('budget-amount-input'), '275');
    await userEvent.click(body.getByRole('button', { name: 'Save budget' }));

    await waitFor(() => {
      expect(requests.find('POST', '/budgets')).toHaveLength(1);
    });
    const [created] = requests.find('POST', '/budgets');
    const payload = created.body as { category?: string; amount?: string };
    expect(Number(payload.amount)).toBe(275);
    expect(String(payload.category)).toMatch(/bills/i);
    await expect(canvas.getAllByText(/bills and utilities/i)).toHaveLength(1);
  },
};

export const DeleteBudget: Story = {
  render: () => <BudgetsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openBudgetsSection(canvas);

    await expect(canvas.queryAllByRole('button', { name: 'Delete budget' })).toHaveLength(0);
    await userEvent.click(canvas.getByRole('button', { name: /edit budgets/i }));

    const deleteButtons = canvas.getAllByRole('button', { name: 'Delete budget' });
    const remainingBefore = deleteButtons.length;
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(requests.find('DELETE', '/budgets/story-budget-1')).toHaveLength(1);
    });
    await waitFor(() => {
      expect(canvas.getAllByRole('button', { name: 'Delete budget' })).toHaveLength(
        remainingBefore - 1
      );
    });
  },
};

export const EditBudgetAmount: Story = {
  render: () => <BudgetsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openBudgetsSection(canvas);
    await userEvent.click(canvas.getByRole('button', { name: /edit budgets/i }));

    const amountInput = canvas.getAllByLabelText(/planned amount/i)[0] as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '750');
    await userEvent.click(canvas.getByRole('button', { name: 'Save budgets' }));

    await waitFor(() => {
      expect(requests.find('PUT', '/budgets/story-budget-1')).toHaveLength(1);
    });
    const [updated] = requests.find('PUT', '/budgets/story-budget-1');
    expect(Number((updated.body as { amount?: string }).amount)).toBe(750);
  },
};

export const EditBudgetRejectsZero: Story = {
  render: () => <BudgetsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openBudgetsSection(canvas);
    await userEvent.click(canvas.getByRole('button', { name: /edit budgets/i }));

    const amountInput = canvas.getAllByLabelText(/planned amount/i)[0] as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '0');
    await userEvent.click(canvas.getByRole('button', { name: 'Save budgets' }));

    await expect(requests.find('PUT', '/budgets/story-budget-1')).toHaveLength(0);
  },
};
