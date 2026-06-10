import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccountsSummaryStats } from './AccountsSummaryStats';

const meta = {
  title: 'Features/Plaid/AccountsSummaryStats',
  component: AccountsSummaryStats,
  tags: ['autodocs', 'test'],
  args: {
    summary: {
      institutions: 2,
      connectedInstitutions: 2,
      accounts: 5,
      latestSync: '2026-05-01T12:00:00.000Z',
    },
    lastSyncValue: '12m ago',
  },
} satisfies Meta<typeof AccountsSummaryStats>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const SyncInProgress: Story = {
  args: {
    lastSyncValue: 'Syncing...',
  },
};

export const NoConnections: Story = {
  args: {
    summary: {
      institutions: 0,
      connectedInstitutions: 0,
      accounts: 0,
      latestSync: null,
    },
    lastSyncValue: 'Never',
  },
};
