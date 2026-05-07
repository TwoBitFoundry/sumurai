import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountFilterProvider } from '@/hooks/useAccountFilter';
import TransactionsPage from '@/views/TransactionsPage';
import { storyProviderAccounts, storyTransactions } from './shared';
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

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/transactions', () => jsonResponse(storyTransactions)),
];

function TransactionsJourney() {
  return (
    <StoryApiScope handlers={handlers}>
      <AccountFilterProvider>
        <TransactionsPage />
      </AccountFilterProvider>
    </StoryApiScope>
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
        expect(
          page.getByText(/coffee collective wholesale roasters group international/i)
        ).toBeVisible();
      },
      { timeout: 3000 }
    );

    const search = canvas.getByPlaceholderText('Search transactions...');
    await userEvent.type(search, 'Coffee');
    await expect(
      canvas.getByText(/coffee collective wholesale roasters group international/i)
    ).toBeVisible();

    const category = canvas.getByRole('button', { name: /food and drink/i });
    await userEvent.click(category);
    await expect(category).toHaveAttribute('aria-pressed', 'true');
  },
};
