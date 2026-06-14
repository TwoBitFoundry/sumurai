import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { BottomContextualBar } from '@/components/BottomContextualBar';
import { TransactionsSearchBar } from '@/features/transactions/components/TransactionsSearchBar';
import { useTransactionFilterState } from '@/features/transactions/hooks/useTransactionFilterState';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import { sampleTransactions, transactionsTablePage } from '@/storybook/fixtures/transactions';
import type { CursorTransactionsResponse, Transaction } from '@/types/api';
import TransactionsPage from '@/views/TransactionsPage';
import { storyCategoryList, storyProviderAccounts, storyTransactionCategories } from './shared';
import { jsonResponse, route, StoryApiScope } from './storyApi';

const meta = {
  title: 'App/Screens/User Journeys/Transactions',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const storyInteractionTimeoutMs = 20_000;

const allTransactions: Transaction[] = [...sampleTransactions, ...transactionsTablePage];

function makeCursorResponse(items: Transaction[]): CursorTransactionsResponse {
  return {
    transactions: items,
    next_cursor: null,
    prev_cursor: null,
    has_more: false,
  };
}

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/categories', () => jsonResponse(storyCategoryList)),
  route('GET', '/transactions/categories', () => jsonResponse(storyTransactionCategories)),
  route('GET', '/transactions', (request) => {
    const search = request.query.get('search')?.toLowerCase();
    const categoryPrimary = request.query.get('category_primary')?.toLowerCase();
    const filtered = allTransactions.filter((t) => {
      const haystack = `${t.merchant ?? ''} ${t.name} ${t.account_name ?? ''}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesCategory =
        !categoryPrimary || t.category?.primary?.toLowerCase() === categoryPrimary;
      return matchesSearch && matchesCategory;
    });
    return jsonResponse(makeCursorResponse(filtered));
  }),
];

function TransactionsJourney() {
  const filterControl = useTransactionFilterState();
  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <TransactionsPage filterControl={filterControl} />
        <BottomContextualBar>
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

    const search = canvas.getByPlaceholderText('Search transactions');
    await userEvent.type(search, 'Coffee');
    await waitFor(
      () => {
        expect(
          page.getByText(/coffee collective wholesale roasters group international/i)
        ).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );

    const toolbar = page.getByTestId('transactions-toolbar');
    const category = await waitFor(
      () => within(toolbar).getByRole('button', { name: /food & drink/i }),
      { timeout: storyInteractionTimeoutMs }
    );
    await userEvent.click(category);
    await waitFor(() => {
      expect(category).toHaveAttribute('aria-pressed', 'true');
    });
  },
};
