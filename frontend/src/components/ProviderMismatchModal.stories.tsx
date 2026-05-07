import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ProviderMismatchModal } from './ProviderMismatchModal';

const meta = {
  title: 'Components/ProviderMismatchModal',
  component: ProviderMismatchModal,
  tags: ['autodocs', 'test'],
  args: {
    userProvider: 'teller',
    defaultProvider: 'plaid',
    onConfirm: fn(),
  },
} satisfies Meta<typeof ProviderMismatchModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args }) => {
    const canvas = within(document.body);
    await userEvent.click(canvas.getByRole('button', { name: /sign out/i }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};
