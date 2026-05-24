import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  AccountsConnectedScreenSlice,
  AccountsProviderPickerLoadingSlice,
  AccountsProviderPickerSlice,
} from '@/storybook/screenSlices/AccountsScreenSlice';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';

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

export const ProviderPicker: Story = {
  decorators: pickerDecorator,
  render: () => <AccountsProviderPickerSlice />,
};

export const ProviderPickerLoading: Story = {
  decorators: pickerDecorator,
  render: () => <AccountsProviderPickerLoadingSlice />,
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
