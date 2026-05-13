import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import TransactionsPage from '@/views/TransactionsPage';
import {
  getPagedStoryTransactions,
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
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const storyInteractionTimeoutMs = 20_000;

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
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

function TransactionsJourney() {
  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <TransactionsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  );
}

export const Journey: Story = {
  render: () => <TransactionsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/review every dollar across accounts/i)).toBeVisible();
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
    const search = canvas.getByPlaceholderText('Search transactions...');
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

    const category = page.getByRole('button', { name: /food and drink/i });
    await userEvent.click(category);
    await expect(category).toHaveAttribute('aria-pressed', 'true');
  },
};
