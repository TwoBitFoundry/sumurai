import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CONNECT_ACCOUNT_PROVIDER_CONTENT } from '@/utils/providerCards';
import { ConnectAccountStep } from './ConnectAccountStep';

const plaid = CONNECT_ACCOUNT_PROVIDER_CONTENT.plaid;
const teller = CONNECT_ACCOUNT_PROVIDER_CONTENT.teller;

const meta = {
  title: 'App/Onboarding/ConnectAccountStep',
  component: ConnectAccountStep,
  tags: ['autodocs', 'test'],
  args: {
    content: plaid,
    providerLoading: false,
    providerError: null,
    onRetryProvider: fn(),
    tellerApplicationId: null,
    isOnline: true,
    isConnected: false,
    connectionInProgress: false,
    institutionName: null,
    error: null,
    onConnect: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof ConnectAccountStep>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlaidDefault: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: new RegExp(plaid.cta.defaultLabel, 'i') })
    );
    await expect(args.onConnect).toHaveBeenCalledTimes(1);
  },
};

export const ProviderLoading: Story = {
  args: {
    providerLoading: true,
    isOnline: true,
  },
};

export const ProviderConfigurationError: Story = {
  args: {
    providerError: 'Unable to load provider configuration.',
    isOnline: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^retry$/i }));
    await expect(args.onRetryProvider).toHaveBeenCalledTimes(1);
  },
};

export const ConnectionInProgress: Story = {
  args: {
    connectionInProgress: true,
    content: plaid,
    isOnline: true,
  },
};

export const Connected: Story = {
  args: {
    isConnected: true,
    institutionName: 'Story Credit Union',
    content: plaid,
    isOnline: true,
  },
};

export const ConnectionFlowError: Story = {
  args: {
    error: 'Link token expired. Retry to generate a fresh session.',
    content: plaid,
    isOnline: true,
  },
};

export const TellerMissingApplicationId: Story = {
  args: {
    content: teller,
    tellerApplicationId: null,
    isOnline: true,
  },
};
