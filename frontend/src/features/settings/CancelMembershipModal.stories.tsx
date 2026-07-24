import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CancelMembershipModal } from './CancelMembershipModal';

const meta = {
  title: 'App/Settings/CancelMembershipModal',
  component: CancelMembershipModal,
  tags: ['autodocs', 'test'],
  args: {
    isOpen: true,
    isPending: false,
    error: null,
    onConfirm: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof CancelMembershipModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('dialog')).toHaveAccessibleName('Cancel membership?');
    await expect(body.getByRole('button', { name: 'Keep membership' })).toHaveFocus();
    await userEvent.click(body.getByRole('button', { name: 'Cancel membership' }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

export const Failure: Story = {
  args: {
    error: 'Cancellation failed. Try again.',
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('alert')).toHaveTextContent('Cancellation failed. Try again.');
    await expect(body.getByRole('button', { name: 'Cancel membership' })).toBeEnabled();
  },
};

export const Pending: Story = {
  args: {
    isPending: true,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', { name: 'Canceling…' })).toBeDisabled();
    await expect(body.getByRole('button', { name: 'Keep membership' })).toBeDisabled();
  },
};
