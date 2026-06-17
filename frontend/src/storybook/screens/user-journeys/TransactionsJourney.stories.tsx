import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { BottomContextualBar } from '@/components/BottomContextualBar';
import { TransactionsFilters } from '@/features/transactions/components/TransactionsFilters';
import { TransactionsSearchBar } from '@/features/transactions/components/TransactionsSearchBar';
import { useTransactionFilterState } from '@/features/transactions/hooks/useTransactionFilterState';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import TransactionsPage from '@/views/TransactionsPage';
import {
  getCursorStoryTransactions,
  storyCategoryList,
  storyProviderAccounts,
  storyTransactionCategories,
} from './shared';
import { jsonResponse, route, StoryApiScope } from './storyApi';

const meta = {
  title: 'App/Screens/User Journeys/Transactions',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
  decorators: [
    (Story) => {
      window.sessionStorage.removeItem('sumurai.ui.transactionsSearch');
      window.sessionStorage.removeItem('sumurai.ui.transactionsCategory');
      return <Story />;
    },
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const storyInteractionTimeoutMs = 20_000;

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/categories', () => jsonResponse(storyCategoryList)),
  route('GET', '/transactions/categories', () => jsonResponse(storyTransactionCategories)),
  route('GET', '/transactions', (request) =>
    jsonResponse(
      getCursorStoryTransactions({
        search: request.query.get('search'),
        categoryPrimary: request.query.get('category_primary'),
        cursor: request.query.get('cursor'),
        limit: Number(request.query.get('limit') ?? '40'),
      })
    )
  ),
];

function TransactionsJourney() {
  const filterControl = useTransactionFilterState({ search: '', category: null });
  const categories = ['Food & Drink', 'Merchandise', 'Services', 'Bills', 'Subscriptions'];
  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <TransactionsPage filterControl={filterControl} />
        <BottomContextualBar
          topContent={
            <TransactionsFilters
              search={filterControl.search}
              onSearch={filterControl.setSearch}
              categories={categories}
              selectedCategory={filterControl.selectedCategory}
              onSelectCategory={filterControl.setSelectedCategory}
              showSearch={false}
              showCategories
              showFilterLabel={false}
              layout="inline"
            />
          }
        >
          <TransactionsSearchBar search={filterControl.search} onSearch={filterControl.setSearch} />
        </BottomContextualBar>
      </StoryApiScope>
    </AccountFilterStoryProvider>
  );
}

export const Journey: Story = {
  render: () => <TransactionsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(
        canvas.getByRole('heading', { name: /tally the ledgers across financial allies/i })
      ).toBeVisible();
    });

    const page = within(canvas.getByTestId('transactions-page'));

    await waitFor(
      () => {
        expect(page.getByRole('region', { name: /transaction list/i })).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );

    const search = within(canvas.getByTestId('transactions-search-bar')).getByPlaceholderText(
      'Search transactions'
    );
    await userEvent.clear(search);
    await userEvent.type(search, 'Coffee');
    await waitFor(
      () => {
        expect(
          page.getByText(/coffee collective wholesale roasters group international/i)
        ).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );

    const filters = canvas.getByTestId('transactions-filters');
    const category = await waitFor(
      () => within(filters).getByRole('button', { name: /food & drink/i }),
      { timeout: storyInteractionTimeoutMs }
    );
    await userEvent.click(category);
    await waitFor(() => {
      expect(category).toHaveAttribute('aria-pressed', 'true');
    });
  },
};
