import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { BottomContextualBar } from '@/components/BottomContextualBar';
import { TransactionsFilters } from '@/features/transactions/components/TransactionsFilters';
import { TransactionsSearchBar } from '@/features/transactions/components/TransactionsSearchBar';
import { useTransactionFilterState } from '@/features/transactions/hooks/useTransactionFilterState';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import {
  getCursorStoryTransactions,
  storyCategoryList,
  storyProviderAccounts,
  storyTransactionCategories,
} from '@/storybook/support/shared';
import { createRequestLog, jsonResponse, route, StoryApiScope } from '@/storybook/support/storyApi';
import TransactionsPage from '@/views/TransactionsPage';

const meta = {
  title: 'App/Journeys/Transactions',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test', 'journey'],
  decorators: [
    (Story) => {
      window.sessionStorage.removeItem('sumurai.ui.transactionsSearch');
      window.sessionStorage.removeItem('sumurai.ui.transactionsCategory');
      requests.clear();
      return <Story />;
    },
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const storyInteractionTimeoutMs = 20_000;

const requests = createRequestLog();

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/categories', () => jsonResponse(storyCategoryList)),
  route('GET', '/transactions/categories', () => jsonResponse(storyTransactionCategories)),
  requests.route('GET', '/transactions', (request) =>
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

export const SearchByMerchant: Story = {
  render: () => <TransactionsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByRole('heading', { name: /explore your ledger/i })).toBeVisible();
    });

    const page = within(canvas.getByTestId('transactions-page'));
    const search = within(canvas.getByTestId('transactions-search-bar')).getByPlaceholderText(
      'Search transactions'
    );
    await userEvent.type(search, 'Coffee');

    await waitFor(
      () => {
        expect(
          requests.find('GET', '/transactions').some((r) => r.query.get('search') === 'coffee')
        ).toBe(true);
      },
      { timeout: storyInteractionTimeoutMs }
    );
    await waitFor(
      () => {
        expect(
          page.getByText(/coffee collective wholesale roasters group international/i)
        ).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );
  },
};

export const FilterByCategory: Story = {
  render: () => <TransactionsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => {
        expect(canvas.getByTestId('transactions-filters')).toBeVisible();
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
      expect(
        requests
          .find('GET', '/transactions')
          .some((r) => /food/i.test(r.query.get('category_primary') ?? ''))
      ).toBe(true);
    });

    await userEvent.click(category);
    await waitFor(() => {
      expect(category).toHaveAttribute('aria-pressed', 'false');
    });
  },
};

export const SearchByMerchantRow: Story = {
  render: () => <TransactionsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const merchantButton = await waitFor(
      () =>
        canvas.getAllByRole('button', { name: /search transactions for coffee collective/i })[0],
      { timeout: storyInteractionTimeoutMs }
    );
    await userEvent.click(merchantButton);

    await waitFor(
      () => {
        expect(
          requests
            .find('GET', '/transactions')
            .some((r) => /^coffee collective/.test(r.query.get('search') ?? ''))
        ).toBe(true);
      },
      { timeout: storyInteractionTimeoutMs }
    );
    const search = within(canvas.getByTestId('transactions-search-bar')).getByPlaceholderText(
      'Search transactions'
    );
    expect((search as HTMLInputElement).value.toLowerCase()).toContain('coffee collective');
  },
};
