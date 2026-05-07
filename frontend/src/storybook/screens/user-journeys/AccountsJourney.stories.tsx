import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import AccountsPage from '@/views/AccountsPage';
import { jsonResponse, route, StoryApiScope } from './storyApi';
import {
  storyPlaidDisconnect,
  storyPlaidStatus,
  storyPlaidSyncTransactions,
  storyProviderAccounts,
  storyProviderInfo,
  storyProviderSelect,
} from './shared';

const meta = {
  title: 'App/Screens/User Journeys/Accounts',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const handlers = [
  route('GET', '/providers/info', () => jsonResponse(storyProviderInfo)),
  route('POST', '/providers/select', () => jsonResponse(storyProviderSelect)),
  route('GET', '/providers/status', () => jsonResponse(storyPlaidStatus)),
  route('GET', '/plaid/accounts', () => jsonResponse(storyProviderAccounts)),
  route('POST', '/plaid/link-token', () => jsonResponse({ link_token: 'story-link-token' })),
  route('POST', '/plaid/exchange-token', () => jsonResponse({ access_token: 'story-access-token' })),
  route('POST', '/providers/sync-transactions', () => jsonResponse(storyPlaidSyncTransactions)),
  route('POST', '/providers/disconnect', () => jsonResponse(storyPlaidDisconnect)),
];

function AccountsJourney() {
  return (
    <StoryApiScope handlers={handlers}>
      <AccountsPage />
    </StoryApiScope>
  );
}

export const Journey: Story = {
  render: () => <AccountsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /use plaid/i })).toBeVisible();
    });

    await userEvent.click(canvas.getByRole('button', { name: /use plaid/i }));
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /sync all/i })).toBeVisible();
    });

    const syncNow = canvas.getAllByRole('button', { name: /sync now/i })[0];
    await userEvent.click(syncNow);
    await waitFor(() => {
      expect(
        body.getByText(/synced 2 new transactions from story federal credit union/i)
      ).toBeVisible();
    });
  },
};
