import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import { TransactionsScreenSlice } from '@/storybook/screenSlices/TransactionsScreenSlice';

const meta = {
  title: 'App/Screens/Transactions',
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <AuthenticatedScreenShell currentTab="transactions">
        <Story />
      </AuthenticatedScreenShell>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  render: () => <TransactionsScreenSlice state="loaded" />,
};

export const LoadedDark: Story = {
  ...storyDarkTheme,
  render: () => <TransactionsScreenSlice state="loaded" />,
};

export const Loading: Story = {
  render: () => <TransactionsScreenSlice state="loading" />,
};

export const Empty: Story = {
  render: () => <TransactionsScreenSlice state="empty" />,
};

export const ApiError: Story = {
  render: () => (
    <TransactionsScreenSlice state="error" errorMessage="Unable to sync transactions from Plaid." />
  ),
};

export const DenseMerchantRow: Story = {
  render: () => <TransactionsScreenSlice state="loaded" tableVariant="denseMerchant" />,
};
