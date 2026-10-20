import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
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
  tags: ['autodocs'],
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
};

export const ProviderPickerSimpleFinConnect: StoryObj<ProviderPickerStoryArgs> = {
  decorators: pickerDecorator,
  args: {
    onSelectProvider: fn(),
  },
  render: (args) => <AccountsProviderPickerSlice onSelectProvider={args.onSelectProvider} />,
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
