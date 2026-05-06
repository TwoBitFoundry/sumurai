import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { FinancialProvider } from '@/types/api';
import { ProviderSelectionPanel } from './ProviderSelectionPanel';

const meta = {
  title: 'Features/Plaid/ProviderSelectionPanel',
  component: ProviderSelectionPanel,
  tags: ['autodocs'],
  args: {
    loading: false,
    error: null,
    selectedProvider: null,
    availableProviders: ['plaid', 'teller'] as FinancialProvider[],
    selectingProvider: null,
    onSelectProvider: async () => {},
  },
} satisfies Meta<typeof ProviderSelectionPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Catalogue: Story = {};

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
