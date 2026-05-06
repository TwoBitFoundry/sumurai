import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { sampleBankConnections } from '@/storybook/fixtures/plaid';
import ConnectionsList from './ConnectionsList';

const meta = {
  title: 'Features/Plaid/ConnectionsList',
  component: ConnectionsList,
  tags: ['autodocs'],
  args: {
    banks: sampleBankConnections,
    onConnect: () => {},
    onSync: async () => {},
    onDisconnect: async () => {},
  },
} satisfies Meta<typeof ConnectionsList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithConnections: Story = {};

export const Empty: Story = {
  args: {
    banks: [],
  },
};
