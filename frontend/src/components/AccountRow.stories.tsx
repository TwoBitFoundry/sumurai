import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { AccountRow } from './AccountRow';

const meta = {
  title: 'Components/AccountRow',
  component: AccountRow,
  tags: ['autodocs', 'test'],
  args: {
    account: {
      id: 'story-account-row-1',
      name: 'Everyday Checking',
      mask: '4821',
      type: 'checking',
      balance: 2450.12,
      transactions: 42,
    },
    isOnline: true,
  },
} satisfies Meta<typeof AccountRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Checking: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/everyday checking/i)).toBeVisible();
    await expect(canvas.getByText(/\$2,450\.12/)).toBeVisible();
    await expect(canvas.getByText(/42 items/i)).toBeVisible();
  },
};

export const Credit: Story = {
  args: {
    account: {
      id: 'story-account-row-2',
      name: 'Rewards Visa',
      mask: '7712',
      type: 'credit',
      balance: -842.4,
      transactions: 128,
    },
  },
};

export const MissingBalance: Story = {
  args: {
    account: {
      id: 'story-account-row-3',
      name: 'Manual Account',
      mask: '0000',
      type: 'other',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/manual account/i)).toBeVisible();
    await expect(canvas.getByText(/placeholder/i)).toBeVisible();
    await expect(canvas.getByText(/0 items/i)).toBeVisible();
  },
};
