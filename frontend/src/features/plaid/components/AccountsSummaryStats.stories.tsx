import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccountsSummaryStats } from './AccountsSummaryStats';

const meta = {
  title: 'Features/Plaid/AccountsSummaryStats',
  component: AccountsSummaryStats,
  tags: ['autodocs'],
  args: {
    flowError: null,
    summary: {
      institutions: 2,
      connectedInstitutions: 2,
      accounts: 5,
      latestSync: '2026-05-01T12:00:00.000Z',
    },
    syncingAll: false,
    lastSyncValue: '12m ago',
    lastSyncDetail: 'Balances refreshed',
  },
} satisfies Meta<typeof AccountsSummaryStats>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const FlowError: Story = {
  args: {
    flowError: 'One institution needs your attention to resume syncing.',
    summary: {
      institutions: 2,
      connectedInstitutions: 1,
      accounts: 3,
      latestSync: null,
    },
  },
};

export const SyncInProgress: Story = {
  args: {
    syncingAll: true,
    lastSyncValue: '…',
    lastSyncDetail: 'Sync in progress',
  },
};
