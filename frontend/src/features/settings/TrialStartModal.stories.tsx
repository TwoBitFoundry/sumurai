import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TrialStartModal } from './TrialStartModal';

const meta = {
  title: 'App/Settings/TrialStartModal',
  component: TrialStartModal,
  tags: ['autodocs', 'test'],
  args: {
    isOpen: true,
    isPending: false,
    error: null,
    onStartTrial: fn(async () => {}),
    onClose: fn(),
  },
} satisfies Meta<typeof TrialStartModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('dialog')).toHaveAccessibleName('Start your free trial');
    await userEvent.type(body.getByLabelText('Country code'), 'us');
    await userEvent.type(body.getByLabelText('Postal code'), '78701');
    await userEvent.click(body.getByRole('button', { name: 'Start free trial' }));
    await expect(args.onStartTrial).toHaveBeenCalledWith({
      country_code: 'US',
      postal_code: '78701',
    });
  },
};

export const Failure: Story = {
  args: {
    error: 'This account has already used its free trial.',
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('alert')).toHaveTextContent(
      'This account has already used its free trial.'
    );
  },
};

export const Pending: Story = {
  args: {
    isPending: true,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', { name: 'Start free trial' })).toBeDisabled();
    await expect(body.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  },
};
