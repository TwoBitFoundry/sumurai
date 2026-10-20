import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import {
  STORY_PICKER_LINK_BUTTON,
  storyFullProviderCatalogInfo,
} from '@/storybook/fixtures/providerPicker';
import {
  expectStoryProviderCardsVisible,
  getStoryProviderPickerButton,
} from '@/storybook/fixtures/providerPickerStoryHelpers';
import { installStoryProviderConnectWindows } from '@/storybook/fixtures/providerPickerStorySetup';
import {
  buildStoryLastInstitutionDisconnectHandlers,
  buildStoryPlaidPickerEmptyHandlers,
  buildStoryTellerPickerEmptyHandlers,
  storyAutoCategorizeHandlers,
  storyPickerEmptyHandlers,
} from '@/storybook/support/shared';
import { createRequestLog, jsonResponse, route, StoryApiScope } from '@/storybook/support/storyApi';
import AccountsPage from '@/views/AccountsPage';

const storyInteractionTimeoutMs = 20_000;

const disconnectRequests = createRequestLog();

async function waitForPickerSdkConnect(
  canvas: ReturnType<typeof within>,
  body: ReturnType<typeof within>,
  timeoutMs = storyInteractionTimeoutMs
) {
  await waitFor(
    () => {
      const connecting = canvas.queryByRole('button', { name: /connecting/i });
      if (connecting) {
        expect(connecting).toBeVisible();
        return;
      }

      const activeBackdrop = body
        .getAllByTestId('provider-sdk-launch-backdrop')
        .find((backdrop) => backdrop.className.includes('opacity-100'));
      expect(activeBackdrop).toBeDefined();
      expect(activeBackdrop!.className).toContain('opacity-100');
    },
    { timeout: timeoutMs }
  );
}

async function waitForAccountsPage(canvas: ReturnType<typeof within>) {
  await waitFor(
    () => {
      expect(canvas.getByTestId('accounts-page')).toBeVisible();
    },
    { timeout: storyInteractionTimeoutMs }
  );
}

async function waitForPrimaryLinkAccount(canvas: ReturnType<typeof within>) {
  await waitFor(
    () => {
      const linkAccount = canvas.getAllByRole('button', { name: STORY_PICKER_LINK_BUTTON })[0];
      expect(linkAccount).toBeEnabled();
    },
    { timeout: storyInteractionTimeoutMs }
  );
}

async function waitForSimpleFinConnectDialog(body: ReturnType<typeof within>) {
  await waitFor(
    () => {
      expect(body.getByRole('dialog', { name: /^simplefin$/i })).toBeVisible();
      expect(body.getByLabelText('SimpleFIN setup token')).toBeVisible();
    },
    { timeout: storyInteractionTimeoutMs }
  );
}

async function openProviderPicker(canvas: ReturnType<typeof within>) {
  await waitForPrimaryLinkAccount(canvas);
  await userEvent.click(canvas.getAllByRole('button', { name: STORY_PICKER_LINK_BUTTON })[0]!);
  await waitForProviderPicker(canvas);
}

async function waitForPickerLinkButtons(canvas: ReturnType<typeof within>) {
  await waitFor(
    () => {
      expect(canvas.getAllByRole('button', { name: STORY_PICKER_LINK_BUTTON })).toHaveLength(3);
    },
    { timeout: storyInteractionTimeoutMs }
  );
}

async function waitForProviderPicker(canvas: ReturnType<typeof within>) {
  await waitFor(
    () => {
      expect(canvas.getByTestId('provider-selection-panel')).toBeVisible();
    },
    { timeout: storyInteractionTimeoutMs }
  );
}

const storySimpleFinProviderInfo = {
  ...storyFullProviderCatalogInfo,
  user_provider: 'simplefin' as const,
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
  title: 'App/Journeys/Accounts',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test', 'journey'],
  decorators: [
    (Story) => {
      patchNavigatorOnline();
      installStoryProviderConnectWindows();
      return <Story />;
    },
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

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
  ...storyFullProviderCatalogInfo,
  user_provider: 'teller' as const,
};

const tellerEmptyStateHandlers = buildStoryTellerPickerEmptyHandlers();

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

const tellerConnectedHandlers = [
  route('GET', '/providers/info', () => jsonResponse(storyTellerProviderInfo)),
  route('GET', '/providers/status', () => jsonResponse(storyTellerStatus)),
  route('GET', '/providers/accounts', () => jsonResponse(storyTellerAccounts)),
  ...storyAutoCategorizeHandlers,
];

export const ProviderPickerEmpty: Story = {
  render: () => (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={storyPickerEmptyHandlers}>
        <AccountsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await openProviderPicker(canvas);

    await expect(canvas.getByText('Choose how you connect accounts')).toBeVisible();
    await expectStoryProviderCardsVisible(canvas);
  },
};

export const PlaidEmptyState: Story = {
  render: () => (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={buildStoryPlaidPickerEmptyHandlers()}>
        <AccountsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await openProviderPicker(canvas);
    await expect(canvas.getByAltText('Plaid logo')).toBeVisible();
    await waitForPickerLinkButtons(canvas);

    await userEvent.click(getStoryProviderPickerButton(canvas, 'plaid'));

    await waitForPickerSdkConnect(canvas, body);
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument();
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

    await openProviderPicker(canvas);

    await expect(canvas.getByAltText('SimpleFIN logo')).toBeVisible();
    await expect(getStoryProviderPickerButton(canvas, 'simplefin')).toBeEnabled();
  },
};

export const LastInstitutionDisconnect: Story = {
  render: () => (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={buildStoryLastInstitutionDisconnectHandlers(disconnectRequests)}>
        <AccountsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    disconnectRequests.clear();
    await waitForAccountsPage(canvas);

    await waitFor(
      () => {
        expect(canvas.getByText('Story Federal Credit Union')).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );

    await userEvent.click(canvas.getByRole('button', { name: /^disconnect$/i }));
    await userEvent.click(body.getByRole('button', { name: /^disconnect$/i }));

    await waitFor(
      () => {
        expect(canvas.queryByText('Story Federal Credit Union')).not.toBeInTheDocument();
        expect(disconnectRequests.find('POST', '/providers/disconnect')).toHaveLength(1);
        expect(
          body.getByText(/story federal credit union disconnected successfully/i)
        ).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );

    await waitForPrimaryLinkAccount(canvas);
    await openProviderPicker(canvas);
    await userEvent.click(getStoryProviderPickerButton(canvas, 'simplefin'));
    await waitForSimpleFinConnectDialog(body);
  },
};

export const LastInstitutionDisconnectPlaidPicker: Story = {
  render: () => (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={buildStoryLastInstitutionDisconnectHandlers(disconnectRequests)}>
        <AccountsPage />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    disconnectRequests.clear();
    await waitForAccountsPage(canvas);

    await waitFor(
      () => {
        expect(canvas.getByText('Story Federal Credit Union')).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );

    await userEvent.click(canvas.getByRole('button', { name: /^disconnect$/i }));
    await userEvent.click(body.getByRole('button', { name: /^disconnect$/i }));

    await waitFor(
      () => {
        expect(canvas.queryByText('Story Federal Credit Union')).not.toBeInTheDocument();
        expect(disconnectRequests.find('POST', '/providers/disconnect')).toHaveLength(1);
        expect(
          body.getByText(/story federal credit union disconnected successfully/i)
        ).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );

    await waitForPrimaryLinkAccount(canvas);
    await openProviderPicker(canvas);
    await waitForPickerLinkButtons(canvas);

    await userEvent.click(getStoryProviderPickerButton(canvas, 'plaid'));

    await waitForPickerSdkConnect(canvas, body);
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument();
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
    await expect(canvas.queryByPlaceholderText('Paste your token')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /^disconnect$/i })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument();
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

    await openProviderPicker(canvas);
    await waitForPickerLinkButtons(canvas);
    await expect(canvas.queryByText('Teller')).toBeNull();
    await expect(canvas.queryByAltText('Teller logo')).toBeNull();
    await expect(getStoryProviderPickerButton(canvas, 'plaid')).toBeVisible();
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
    await expect(canvas.getByRole('button', { name: /sync now/i })).toBeVisible();
  },
};
