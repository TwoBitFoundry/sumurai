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

const storyAutoCategorizeHandlers = [
  route('GET', '/transactions/auto-categorize', () => jsonResponse(null)),
  route('POST', '/transactions/auto-categorize', () =>
    jsonResponse({
      job_id: '11111111-2222-3333-4444-555555555555',
      status: 'running',
      total: 12,
      processed: 0,
      updated: 0,
      skipped: 0,
      started_at: '2026-05-01T12:00:00.000Z',
      finished_at: null,
      error_message: null,
    })
  ),
  route('DELETE', '/transactions/auto-categorize', () =>
    jsonResponse({
      job_id: '11111111-2222-3333-4444-555555555555',
      status: 'cancelling',
      total: 12,
      processed: 4,
      updated: 2,
      skipped: 2,
      started_at: '2026-05-01T12:00:00.000Z',
      finished_at: null,
      error_message: null,
    })
  ),
];

const storySimpleFinProviderInfo = {
  available_providers: ['simplefin'],
  default_provider: 'simplefin',
  user_provider: 'simplefin',
};

const storySimpleFinAccounts = [
  {
    id: 'story-simplefin-account-1',
    name: 'Everyday Checking',
    provider: 'simplefin',
    account_type: 'depository',
    balance_ledger: 18420.18,
    balance_available: 18120.18,
    mask: '4821',
    institution_name: 'Story SimpleFIN Credit Union',
    connection_id: 'story-simplefin-conn-1',
    transaction_count: 42,
  },
];

const storySimpleFinStatus = {
  provider: 'simplefin',
  connections: [
    {
      connection_id: 'story-simplefin-conn-1',
      institution_name: 'Story SimpleFIN Credit Union',
      last_sync_at: '2026-05-01T12:00:00.000Z',
      transaction_count: 42,
      account_count: 1,
      is_connected: true,
      sync_in_progress: false,
      item_id: 'simplefin_story-simplefin-conn-1',
    },
  ],
};

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
  ...storyAutoCategorizeHandlers,
];

const simpleFinEmptyStateHandlers = [
  route('GET', '/providers/info', () => jsonResponse(storySimpleFinProviderInfo)),
  route('GET', '/providers/status', () =>
    jsonResponse({
      provider: 'simplefin',
      connections: [],
    })
  ),
  route('GET', '/providers/accounts', () => jsonResponse([])),
  route('GET', '/providers/simplefin/ignored-institutions', () =>
    jsonResponse({ institutions: [] })
  ),
  ...storyAutoCategorizeHandlers,
];

const simpleFinConnectedHandlers = [
  route('GET', '/providers/info', () => jsonResponse(storySimpleFinProviderInfo)),
  route('GET', '/providers/status', () => jsonResponse(storySimpleFinStatus)),
  route('GET', '/providers/accounts', () => jsonResponse(storySimpleFinAccounts)),
  ...storyAutoCategorizeHandlers,
];

const storyTellerProviderInfo = {
  available_providers: ['plaid', 'teller'],
  default_provider: 'teller',
  user_provider: 'teller',
  teller_application_id: 'story-teller-app',
  teller_environment: 'sandbox',
};

const storyTellerAccounts = [
  {
    id: 'story-teller-account-1',
    name: 'Checking',
    provider: 'teller',
    account_type: 'depository',
    balance_ledger: 8420.18,
    balance_available: 8120.18,
    mask: '5577',
    institution_name: 'Story Teller Bank',
    connection_id: 'story-teller-conn-1',
    transaction_count: 18,
  },
];

const storyTellerStatus = {
  provider: 'teller',
  connections: [
    {
      connection_id: 'story-teller-conn-1',
      institution_name: 'Story Teller Bank',
      last_sync_at: '2026-05-02T12:00:00.000Z',
      transaction_count: 18,
      account_count: 1,
      is_connected: true,
      sync_in_progress: false,
    },
  ],
};

const tellerEmptyStateHandlers = [
  route('GET', '/providers/info', () => jsonResponse(storyTellerProviderInfo)),
  route('GET', '/providers/status', () =>
    jsonResponse({
      provider: 'teller',
      connections: [],
    })
  ),
  route('GET', '/providers/accounts', () => jsonResponse([])),
  ...storyAutoCategorizeHandlers,
];

const tellerConnectedHandlers = [
  route('GET', '/providers/info', () => jsonResponse(storyTellerProviderInfo)),
  route('GET', '/providers/status', () => jsonResponse(storyTellerStatus)),
  route('GET', '/providers/accounts', () => jsonResponse(storyTellerAccounts)),
  ...storyAutoCategorizeHandlers,
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
        expect(
          body.getByText(/synced \d+ transactions for story federal credit union/i)
        ).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );
  },
};

export const SimpleFinEmptyState: Story = {
  render: () => (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={simpleFinEmptyStateHandlers}>
        <AccountsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByPlaceholderText('Paste your SimpleFIN setup token')).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );
    await expect(canvas.queryByRole('button', { name: /^simplefin$/i })).not.toBeInTheDocument();
  },
};

export const SimpleFinConnected: Story = {
  render: () => (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={simpleFinConnectedHandlers}>
        <AccountsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByText('Story SimpleFIN Credit Union')).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );
    await expect(
      canvas.queryByPlaceholderText('Paste your SimpleFIN setup token')
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^simplefin$/i })).not.toBeInTheDocument();
  },
};

export const TellerEmptyState: Story = {
  render: () => (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={tellerEmptyStateHandlers}>
        <AccountsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getAllByRole('button', { name: /^teller$/i })).toHaveLength(2);
      },
      { timeout: storyInteractionTimeoutMs }
    );
    await expect(canvas.getByText(/no teller accounts connected yet/i)).toBeVisible();
  },
};

export const TellerConnected: Story = {
  render: () => (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={tellerConnectedHandlers}>
        <AccountsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByText('Story Teller Bank')).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );
    await expect(canvas.getByRole('button', { name: /teller/i })).toBeVisible();
  },
};
