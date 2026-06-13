import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import { sampleSankeySurplus } from '@/storybook/fixtures/analytics';
import { sampleBudgetProgressEntries } from '@/storybook/fixtures/budgets';
import { sampleFixedExpenses } from '@/storybook/fixtures/fixed-expenses';
import type { DateRangeKey } from '@/utils/dateRanges';
import DashboardPage from '@/views/DashboardPage';
import {
  getPagedStoryTransactions,
  storyCategoryList,
  storyDashboardFixtures,
  storyProviderAccounts,
  storyTransactionCategories,
} from './shared';
import { jsonResponse, route, StoryApiScope } from './storyApi';

const meta = {
  title: 'App/Screens/User Journeys/Dashboard',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const handlers = [
  route('GET', '/categories', () => jsonResponse(storyCategoryList)),
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/budgets/overview', () =>
    jsonResponse({
      budgets: sampleBudgetProgressEntries.map(({ spent, percentage, ...budget }) => budget),
      fixed_expenses: sampleFixedExpenses,
    })
  ),
  route('GET', '/analytics/balances/overview', () =>
    jsonResponse(storyDashboardFixtures.balancesOverview)
  ),
  route('GET', '/analytics/cash-flow', () =>
    jsonResponse({
      currency: 'USD',
      series: [
        { month: '2026-01', income: 4200, expenses: 2800, net: 1400 },
        { month: '2026-02', income: 3900, expenses: 3100, net: 800 },
        { month: '2026-03', income: 4500, expenses: 2600, net: 1900 },
        { month: '2026-04', income: 4100, expenses: 3400, net: 700 },
        { month: '2026-05', income: 4600, expenses: 2900, net: 1700 },
        { month: '2026-06', income: 4300, expenses: 3200, net: 1100 },
      ],
    })
  ),
  route('GET', '/analytics/sankey', () => jsonResponse(sampleSankeySurplus)),
  route('GET', '/analytics/spending', () => jsonResponse(storyDashboardFixtures.spendingTotal)),
  route('GET', '/analytics/categories', () => jsonResponse(storyDashboardFixtures.categories)),
  route('GET', '/analytics/top-merchants', () => jsonResponse(storyDashboardFixtures.topMerchants)),
  route('GET', '/analytics/monthly-totals', () =>
    jsonResponse(storyDashboardFixtures.monthlyTotals)
  ),
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

function DashboardJourney() {
  const setDateRange = (_range: DateRangeKey) => {};

  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <DashboardPage dateRange="current-month" setDateRange={setDateRange} />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  );
}

export const Journey: Story = {
  render: () => <DashboardJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByRole('heading', { name: /appraise the treasury/i })).toBeVisible();
    });
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /food & drink/i })).toBeVisible();
    });
    await waitFor(
      () => {
        expect(canvas.getByTestId('sankey-node-income')).toBeVisible();
      },
      { timeout: 15000 }
    );

    await userEvent.click(canvas.getByRole('tab', { name: /show balance insights/i }));
    await waitFor(() => {
      expect(canvas.getByTestId('balances-chart-plot')).toBeVisible();
    });
    await userEvent.click(canvas.getByRole('tab', { name: /show money flow/i }));
    await waitFor(
      () => {
        expect(canvas.getByTestId('sankey-node-income')).toBeVisible();
      },
      { timeout: 15000 }
    );

    const foodCard = canvas.getByRole('button', { name: /food & drink/i });

    await userEvent.hover(foodCard);
    await waitFor(() => {
      expect(foodCard).toHaveStyle({ borderColor: expect.any(String) });
    });
  },
};
