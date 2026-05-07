import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { FinancialProvider } from '@/types/api';
import { ProviderSelectionPanel } from './ProviderSelectionPanel';

const meta = {
  title: 'Features/Plaid/ProviderSelectionPanel',
  component: ProviderSelectionPanel,
  tags: ['autodocs', 'test'],
  args: {
    loading: false,
    error: null,
    selectedProvider: null,
    availableProviders: ['plaid', 'teller'] as FinancialProvider[],
    selectingProvider: null,
    onSelectProvider: fn(),
  },
} satisfies Meta<typeof ProviderSelectionPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Catalogue: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /use plaid/i }));
    await expect(args.onSelectProvider).toHaveBeenCalledWith('plaid');
  },
};

export const Loading: Story = {
  args: { loading: true },
};

export const ErrorState: Story = {
  args: {
    error: 'Providers unavailable',
    loading: false,
  },
};

export const Selecting: Story = {
  args: {
    selectingProvider: 'plaid',
  },
};
