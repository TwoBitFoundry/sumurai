import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { STORY_ALL_PROVIDERS, storyConnectButtonIndex } from '@/storybook/fixtures/providerPicker';
import {
  AccountsConnectedScreenSlice,
  AccountsProviderPickerSlice,
} from '@/storybook/screenSlices/AccountsScreenSlice';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import type { FinancialProvider } from '@/types/api';

const pickerDecorator = [
  (Story) => (
    <AuthenticatedScreenShell currentTab="accounts">
      <Story />
    </AuthenticatedScreenShell>
  ),
];

const connectedDecorator = [
  (Story) => (
    <AuthenticatedScreenShell currentTab="accounts">
      <Story />
    </AuthenticatedScreenShell>
  ),
];

const meta = {
  title: 'App/Screens/Accounts',
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

type ProviderPickerStoryArgs = {
  onSelectProvider: (provider: FinancialProvider) => void | Promise<void>;
};

export const ProviderPicker: StoryObj<ProviderPickerStoryArgs> = {
  decorators: pickerDecorator,
  args: {
    onSelectProvider: fn(),
  },
  render: (args) => <AccountsProviderPickerSlice onSelectProvider={args.onSelectProvider} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('provider-selection-panel')).toBeVisible();
    await expect(canvas.getByText('Choose how you connect accounts')).toBeVisible();
    for (const provider of STORY_ALL_PROVIDERS) {
      const label =
        provider === 'simplefin'
          ? 'SimpleFIN'
          : provider.charAt(0).toUpperCase() + provider.slice(1);
      await expect(canvas.getByAltText(`${label} logo`)).toBeVisible();
    }
    const connectButtons = canvas.getAllByRole('button', { name: /^connect$/i });
    await expect(connectButtons).toHaveLength(3);
    await expect(connectButtons[storyConnectButtonIndex('plaid')]).toBeEnabled();
    await expect(connectButtons[storyConnectButtonIndex('teller')]).toBeEnabled();
    await expect(connectButtons[storyConnectButtonIndex('simplefin')]).toBeEnabled();
    await userEvent.click(connectButtons[storyConnectButtonIndex('plaid')]!);
    await expect(args.onSelectProvider).toHaveBeenCalledWith('plaid');
  },
};

export const ProviderPickerTellerConnect: StoryObj<ProviderPickerStoryArgs> = {
  decorators: pickerDecorator,
  args: {
    onSelectProvider: fn(),
  },
  render: (args) => <AccountsProviderPickerSlice onSelectProvider={args.onSelectProvider} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const connectButtons = canvas.getAllByRole('button', { name: /^connect$/i });
    await userEvent.click(connectButtons[storyConnectButtonIndex('teller')]!);
    await expect(args.onSelectProvider).toHaveBeenCalledWith('teller');
  },
};

export const ProviderPickerSimpleFinConnect: StoryObj<ProviderPickerStoryArgs> = {
  decorators: pickerDecorator,
  args: {
    onSelectProvider: fn(),
  },
  render: (args) => <AccountsProviderPickerSlice onSelectProvider={args.onSelectProvider} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const connectButtons = canvas.getAllByRole('button', { name: /^connect$/i });
    await userEvent.click(connectButtons[storyConnectButtonIndex('simplefin')]!);
    await expect(args.onSelectProvider).toHaveBeenCalledWith('simplefin');
  },
};

export const Connected: Story = {
  decorators: connectedDecorator,
  render: () => <AccountsConnectedScreenSlice />,
};

export const ConnectedDark: Story = {
  ...storyDarkTheme,
  decorators: connectedDecorator,
  render: () => <AccountsConnectedScreenSlice />,
};

export const ConnectedFlowError: Story = {
  decorators: connectedDecorator,
  render: () => (
    <AccountsConnectedScreenSlice flowError="Institution sync paused until you reconnect." />
  ),
};

export const ConnectedEmptyConnections: Story = {
  decorators: connectedDecorator,
  render: () => <AccountsConnectedScreenSlice connectionsEmpty />,
};

export const ConnectedToast: Story = {
  decorators: connectedDecorator,
  render: () => <AccountsConnectedScreenSlice toastMessage="First Bank linked successfully." />,
};

export const SyncInProgress: Story = {
  decorators: connectedDecorator,
  render: () => <AccountsConnectedScreenSlice syncingAll />,
};
