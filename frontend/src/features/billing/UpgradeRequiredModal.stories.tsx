import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { UpgradeRequiredModal } from './UpgradeRequiredModal';

const meta = {
  title: 'Billing/UpgradeRequiredModal',
  component: UpgradeRequiredModal,
  tags: ['autodocs', 'test'],
  args: {
    isOpen: true,
    onClose: fn(),
    onViewPlans: fn(),
  },
} satisfies Meta<typeof UpgradeRequiredModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('dialog')).toHaveAccessibleName('Paid access required');
    await expect(body.getByRole('alert')).toHaveTextContent(
      'Choose a plan to continue using your financial data.'
    );
    await expect(body.getByRole('button', { name: 'Not now' })).toHaveFocus();
  },
};

export const Dismissal: Story = {
  play: async ({ args }) => {
    await userEvent.keyboard('{Escape}');
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

export const ViewPlans: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: 'View plans in Settings' }));
    await expect(args.onViewPlans).toHaveBeenCalledTimes(1);
  },
};
