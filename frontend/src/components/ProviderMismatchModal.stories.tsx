import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProviderMismatchModal } from './ProviderMismatchModal';

const meta = {
  title: 'Components/ProviderMismatchModal',
  component: ProviderMismatchModal,
  tags: ['autodocs'],
  args: {
    userProvider: 'teller',
    defaultProvider: 'plaid',
    onConfirm: () => {},
  },
} satisfies Meta<typeof ProviderMismatchModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
