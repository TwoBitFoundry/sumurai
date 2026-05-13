import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import AccountsPage from '@/views/AccountsPage';
import {
  storyPlaidDisconnect,
  storyPlaidStatus,
  storyPlaidSyncTransactions,
  storyProviderAccounts,
  storyProviderInfo,
  storyProviderSelect,
} from './shared';
import { jsonResponse, route, StoryApiScope } from './storyApi';

const storyInteractionTimeoutMs = 20_000;

function patchNavigatorOnline() {
  if (typeof navigator === 'undefined') {
    return;
  }
  try {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    });
  } catch {
    return;
  }
}

const meta = {
  title: 'App/Screens/User Journeys/Accounts',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
  decorators: [
    (Story) => {
      patchNavigatorOnline();
      return <Story />;
    },
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const handlers = [
  route('GET', '/providers/info', () => jsonResponse(storyProviderInfo)),
  route('POST', '/providers/select', () => jsonResponse(storyProviderSelect)),
  route('GET', '/providers/status', () => jsonResponse(storyPlaidStatus)),
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/plaid/accounts', () => jsonResponse(storyProviderAccounts)),
  route('POST', '/plaid/link-token', () => jsonResponse({ link_token: 'story-link-token' })),
  route('POST', '/plaid/exchange-token', () =>
    jsonResponse({ access_token: 'story-access-token' })
  ),
  route('POST', '/providers/sync-transactions', () => jsonResponse(storyPlaidSyncTransactions)),
  route('POST', '/providers/disconnect', () => jsonResponse(storyPlaidDisconnect)),
];

function AccountsJourney() {
  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <AccountsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  );
}

export const Journey: Story = {
  render: () => <AccountsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await waitFor(
      () => {
        expect(canvas.getByTestId('accounts-page')).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );

    await waitFor(
      () => {
        expect(canvas.getAllByRole('button', { name: /sync now/i }).length).toBeGreaterThan(0);
      },
      { timeout: storyInteractionTimeoutMs }
    );

    const syncNow = canvas.getAllByRole('button', { name: /sync now/i })[0];
    await userEvent.click(syncNow);
    await waitFor(
      () => {
        expect(body.getByText(/sync started for story federal credit union/i)).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );
  },
};
