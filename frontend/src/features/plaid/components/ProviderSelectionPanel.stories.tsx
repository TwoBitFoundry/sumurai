import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  storyConnectButtonIndex,
  storyProviderPickerPanelProps,
} from '@/storybook/fixtures/providerPicker';
import type { FinancialProvider } from '@/types/api';
import { ProviderSelectionPanel } from './ProviderSelectionPanel';

const fullCatalogueArgs = {
  ...storyProviderPickerPanelProps,
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
    await expect(canvas.getByTestId('provider-selection-panel')).toBeVisible();
    await expect(canvas.getByText('Choose how you connect accounts')).toBeVisible();
    await expect(canvas.getByAltText('Teller logo')).toBeVisible();
    await expect(canvas.getByAltText('SimpleFIN logo')).toBeVisible();
    await expect(canvas.getByAltText('Plaid logo')).toBeVisible();
    const connectButtons = canvas.getAllByRole('button', { name: /^connect$/i });
    await userEvent.click(connectButtons[storyConnectButtonIndex('plaid')]!);
    await expect(args.onSelectProvider).toHaveBeenCalledWith('plaid');
  },
};

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('provider-loading-panel')).toBeVisible();
    await expect(canvas.getByText(/loading provider catalogue/i)).toBeVisible();
  },
};

export const ErrorState: Story = {
  args: {
    error: 'Providers unavailable',
    loading: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('provider-error-panel')).toBeVisible();
    await expect(canvas.getByText('Providers unavailable')).toBeVisible();
  },
};

export const TellerDisabled: Story = {
  args: {
    availableProviders: ['plaid', 'simplefin'] as FinancialProvider[],
    tellerApplicationId: null,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const connectButtons = canvas.getAllByRole('button', { name: /^connect$/i });
    await expect(connectButtons[storyConnectButtonIndex('teller')]).toBeDisabled();
    await userEvent.click(connectButtons[storyConnectButtonIndex('simplefin')]!);
    await expect(args.onSelectProvider).toHaveBeenCalledWith('simplefin');
  },
};

export const ZeroCreds: Story = {
  args: {
    availableProviders: [] as FinancialProvider[],
    tellerApplicationId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const connectButtons = canvas.getAllByRole('button', { name: /^connect$/i });
    await expect(connectButtons[storyConnectButtonIndex('teller')]).toBeDisabled();
    await expect(connectButtons[storyConnectButtonIndex('plaid')]).toBeDisabled();
    await expect(connectButtons[storyConnectButtonIndex('simplefin')]).toBeEnabled();
  },
};

export const Selecting: Story = {
  args: {
    connectingProvider: 'plaid',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /connecting/i })).toBeVisible();
  },
};
