import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import ConnectButton from './ConnectButton';

const meta = {
  title: 'Features/Plaid/ConnectButton',
  component: ConnectButton,
  tags: ['autodocs', 'test'],
  args: {
    children: 'Add account',
    onClick: fn(),
  },
} satisfies Meta<typeof ConnectButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const PrimaryInteraction: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /add account/i }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};
