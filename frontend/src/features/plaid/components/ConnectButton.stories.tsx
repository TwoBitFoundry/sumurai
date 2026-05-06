import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ConnectButton from './ConnectButton';

const meta = {
  title: 'Features/Plaid/ConnectButton',
  component: ConnectButton,
  tags: ['autodocs'],
  args: {
    children: 'Add account',
    onClick: () => {},
  },
} satisfies Meta<typeof ConnectButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};
