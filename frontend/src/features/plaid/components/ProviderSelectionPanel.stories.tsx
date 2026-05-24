import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { FinancialProvider } from '@/types/api';
import { ProviderSelectionPanel } from './ProviderSelectionPanel';

const fullCatalogueArgs = {
  loading: false,
  error: null,
  selectedProvider: null,
  availableProviders: ['plaid', 'teller', 'simplefin'] as FinancialProvider[],
  tellerApplicationId: 'story-teller-app',
  selectingProvider: null,
  onSelectProvider: fn(),
};

const meta = {
  title: 'Features/Plaid/ProviderSelectionPanel',
  component: ProviderSelectionPanel,
  tags: ['autodocs', 'test'],
  args: fullCatalogueArgs,
  parameters: {
    docs: {
      description: {
        component:
          'Provider picker with the Self-Hosted eyebrow, pricing and privacy sections, and enabled or disabled provider states.',
      },
    },
  },
} satisfies Meta<typeof ProviderSelectionPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllEnabled: Story = {
  args: fullCatalogueArgs,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /select plaid/i }));
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

export const TellerDisabled: Story = {
  args: {
    availableProviders: ['plaid', 'simplefin'] as FinancialProvider[],
    tellerApplicationId: null,
  },
};

export const ZeroCreds: Story = {
  args: {
    availableProviders: [] as FinancialProvider[],
    tellerApplicationId: null,
  },
};

export const Selecting: Story = {
  args: {
    selectingProvider: 'plaid',
  },
};
