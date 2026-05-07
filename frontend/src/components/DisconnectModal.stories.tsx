import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { sampleBankConnections } from '@/storybook/fixtures/plaid';
import { DisconnectModal } from './DisconnectModal';

const storyBank = {
  ...sampleBankConnections[0],
  lastSync: sampleBankConnections[0].lastSync ?? undefined,
};

const meta = {
  title: 'Components/DisconnectModal',
  component: DisconnectModal,
  tags: ['autodocs', 'test'],
  args: {
    isOpen: true,
    bank: storyBank,
    onConfirm: fn(),
    onCancel: fn(),
    loading: false,
  },
} satisfies Meta<typeof DisconnectModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText(/disconnect story federal credit union/i)).toBeVisible();
    await expect(body.getByText(/2 accounts/i)).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: /^cancel$/i }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
  },
};

export const ConfirmInteraction: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: /^disconnect$/i }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', { name: /disconnecting/i })).toBeDisabled();
    await expect(body.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
  },
};
