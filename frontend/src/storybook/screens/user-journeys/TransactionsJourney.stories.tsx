import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { BottomContextualBar } from '@/components/BottomContextualBar';
import { TransactionsSearchBar } from '@/features/transactions/components/TransactionsSearchBar';
import { useTransactionFilterState } from '@/features/transactions/hooks/useTransactionFilterState';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import TransactionsPage from '@/views/TransactionsPage';
import { getPagedStoryTransactions, storyCategoryList, storyProviderAccounts } from './shared';
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

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/categories', () => jsonResponse(storyCategoryList)),
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
      expect(canvas.getByRole('heading', { name: /slice your ledger/i })).toBeVisible();
    });

    const page = within(canvas.getByTestId('transactions-page'));

    await waitFor(() => {
      expect(page.getByText(/page 1 of 2/i)).toBeVisible();
    });

    const nextPage = page.getByRole('button', { name: /next page/i });
    await waitFor(() => {
      expect(nextPage).not.toBeDisabled();
    });
    await userEvent.click(nextPage);
    await waitFor(
      () => {
        expect(page.getByText(/page 2 of 2/i)).toBeVisible();
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
        expect(page.getByText(/page 1 of 1/i)).toBeVisible();
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
