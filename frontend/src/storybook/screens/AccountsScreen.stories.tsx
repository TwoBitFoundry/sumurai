import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  expectStoryProviderCardsVisible,
  getStoryProviderPickerButton,
} from '@/storybook/fixtures/providerPickerStoryHelpers';
import {
  AccountsConnectedScreenSlice,
  AccountsProviderPickerSlice,
} from '@/storybook/screenSlices/AccountsScreenSlice';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
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
    await expectStoryProviderCardsVisible(canvas);
    await expect(getStoryProviderPickerButton(canvas, 'plaid')).toBeEnabled();
    await expect(getStoryProviderPickerButton(canvas, 'simplefin')).toBeEnabled();
    await expect(getStoryProviderPickerButton(canvas, 'diy')).toBeEnabled();
    await expect(canvas.queryByText('Teller')).toBeNull();
    await userEvent.click(getStoryProviderPickerButton(canvas, 'plaid'));
    await expect(args.onSelectProvider).toHaveBeenCalledWith('plaid');
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
    await userEvent.click(getStoryProviderPickerButton(canvas, 'simplefin'));
    await expect(args.onSelectProvider).toHaveBeenCalledWith('simplefin');
  },
};

export const Connected: Story = {
  decorators: connectedDecorator,
  render: () => <AccountsConnectedScreenSlice />,
};

export const ConnectedFlowError: Story = {
  decorators: connectedDecorator,
  render: () => (
    <AccountsConnectedScreenSlice flowError="Institution sync paused until you reconnect." />
  ),
};

export const ConnectedToast: Story = {
  decorators: connectedDecorator,
  render: () => <AccountsConnectedScreenSlice toastMessage="First Bank linked successfully." />,
};

export const SyncInProgress: Story = {
  decorators: connectedDecorator,
  render: () => <AccountsConnectedScreenSlice syncingAll />,
};
