import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { sampleBankConnections } from '@/storybook/fixtures/plaid';
import ConnectionsList from './ConnectionsList';

const meta = {
  title: 'Features/Plaid/ConnectionsList',
  component: ConnectionsList,
  tags: ['autodocs', 'test'],
  decorators: [
    (Story) => {
      window.sessionStorage.removeItem('sumurai.ui.accountsBankExpanded');
      return <Story />;
    },
  ],
  args: {
    banks: sampleBankConnections,
    onConnect: fn(),
    onSync: fn(async () => {}),
    onDisconnect: fn(async () => {}),
    isOnline: true,
  },
} satisfies Meta<typeof ConnectionsList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithConnections: Story = {};

export const BankOperations: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/story federal credit union/i)).toBeVisible();
    await userEvent.click(canvas.getAllByRole('button', { name: /sync now/i })[0]);
    await expect(args.onSync).toHaveBeenCalledWith(sampleBankConnections[0].id);
    await userEvent.click(canvas.getAllByRole('button', { name: /show accounts/i })[0]);
    await userEvent.click(canvas.getAllByRole('button', { name: /hide accounts/i })[0]);
    await expect(canvas.getAllByRole('button', { name: /show accounts/i })[0]).toBeVisible();
  },
};

export const Empty: Story = {
  args: {
    banks: [],
    isOnline: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/no accounts connected yet/i)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /add ally account/i }));
    await expect(args.onConnect).toHaveBeenCalledTimes(1);
  },
};
