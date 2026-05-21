import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { sampleBankConnections } from '@/storybook/fixtures/plaid';
import { BankCard } from './BankCard';

const storyBank = {
  ...sampleBankConnections[0],
  lastSync: sampleBankConnections[0].lastSync ?? undefined,
};

const storyNeedsReauthBank = {
  ...sampleBankConnections[1],
  lastSync: sampleBankConnections[1].lastSync ?? undefined,
};

const meta = {
  title: 'Components/BankCard',
  component: BankCard,
  tags: ['autodocs', 'test'],
  decorators: [
    (Story) => {
      window.sessionStorage.removeItem('sumurai.ui.accountsBankExpanded');
      return <Story />;
    },
  ],
  args: {
    bank: storyBank,
    onSync: fn(async () => {}),
    onDisconnect: fn(async () => {}),
    isOnline: true,
  },
} satisfies Meta<typeof BankCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/story federal credit union/i)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /show accounts/i }));
    await waitFor(() => {
      expect(canvas.getByText(/premium rewards checking/i)).toBeVisible();
    });
    await userEvent.click(canvas.getByRole('button', { name: /sync now/i }));
    await expect(args.onSync).toHaveBeenCalledWith(storyBank.id);
  },
};

export const CollapseAccounts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /show accounts/i }));
    await waitFor(() => {
      expect(canvas.getByText(/premium rewards checking/i)).toBeVisible();
    });
    await userEvent.click(canvas.getByRole('button', { name: /hide accounts/i }));
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /show accounts/i })).toBeVisible();
      expect(canvas.queryByText(/premium rewards checking/i)).not.toBeInTheDocument();
    });
    await userEvent.click(canvas.getByRole('button', { name: /show accounts/i }));
    await waitFor(() => {
      expect(canvas.getByText(/premium rewards checking/i)).toBeVisible();
    });
  },
};

export const NeedsReauth: Story = {
  args: {
    bank: storyNeedsReauthBank,
    isOnline: true,
  },
};
