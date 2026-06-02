import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import SettingsPage from '@/views/SettingsPage';
import { jsonResponse, route, StoryApiScope } from './storyApi';

type SettingsJourneyStoryArgs = {
  onLogout: () => void;
};

const meta = {
  title: 'App/Screens/User Journeys/Settings',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
  args: {
    onLogout: fn(),
  },
} satisfies Meta<SettingsJourneyStoryArgs>;

export default meta;

type Story = StoryObj<SettingsJourneyStoryArgs>;

const successHandlers = [
  route('GET', '/auth/passkey', () => jsonResponse([])),
  route('DELETE', '/auth/account', () =>
    jsonResponse({
      message: 'Account deleted',
      deleted_items: {
        connections: 0,
        transactions: 12,
        accounts: 3,
        budgets: 2,
      },
    })
  ),
];

const deleteFailureHandlers = [
  route('GET', '/auth/passkey', () => jsonResponse([])),
  route('DELETE', '/auth/account', () =>
    jsonResponse({ message: 'Account deletion failed. Try again.' }, { status: 500 })
  ),
];

function SettingsJourney(props: { handlers: typeof successHandlers; onLogout?: () => void }) {
  return (
    <StoryApiScope handlers={props.handlers}>
      <SettingsPage onLogout={props.onLogout} />
    </StoryApiScope>
  );
}

export const Journey: Story = {
  render: (args) => <SettingsJourney handlers={successHandlers} onLogout={args.onLogout} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await waitFor(() => {
      expect(canvas.getByRole('heading', { name: /appearance/i })).toBeVisible();
    });

    await userEvent.click(canvas.getByRole('radio', { name: /light/i }));

    await userEvent.click(canvas.getByRole('button', { name: /delete account/i }));
    await userEvent.type(body.getByLabelText(/^type delete to confirm$/i), 'DELETE');
    const deleteForever = body.getByRole('button', { name: /delete forever/i });
    await expect(deleteForever).toBeEnabled();
  },
};

export const DeleteAccountCancel: Story = {
  render: (args) => <SettingsJourney handlers={successHandlers} onLogout={args.onLogout} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: /delete account/i }));
    await expect(body.getByRole('heading', { name: /delete account/i })).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: /^exit$/i }));
    await waitFor(() => {
      expect(body.queryByRole('heading', { name: /delete account/i })).not.toBeInTheDocument();
    });
  },
};

export const DeleteAccountBackdropClose: Story = {
  render: (args) => <SettingsJourney handlers={successHandlers} onLogout={args.onLogout} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: /delete account/i }));
    await expect(body.getByRole('heading', { name: /delete account/i })).toBeVisible();
    await userEvent.click(body.getByTestId('modal-backdrop'));
    await waitFor(() => {
      expect(body.queryByRole('heading', { name: /delete account/i })).not.toBeInTheDocument();
    });
  },
};

export const DeleteAccountValidation: Story = {
  render: (args) => <SettingsJourney handlers={successHandlers} onLogout={args.onLogout} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: /delete account/i }));
    const deleteForever = body.getByRole('button', { name: /delete forever/i });
    await expect(deleteForever).toBeDisabled();

    const confirm = body.getByLabelText(/^type delete to confirm$/i);
    await userEvent.type(confirm, 'DEL');
    await expect(confirm).toHaveAttribute('data-variant', 'invalid');
    await expect(deleteForever).toBeDisabled();

    await userEvent.clear(confirm);
    await userEvent.type(confirm, 'DELETE');
    await expect(confirm).toHaveAttribute('data-variant', 'default');
    await expect(deleteForever).toBeEnabled();
  },
};

export const DeleteAccountSuccess: Story = {
  render: (args) => <SettingsJourney handlers={successHandlers} onLogout={args.onLogout} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: /delete account/i }));
    await userEvent.type(body.getByLabelText(/^type delete to confirm$/i), 'DELETE');
    await userEvent.click(body.getByRole('button', { name: /delete forever/i }));
    await waitFor(() => {
      expect(args.onLogout).toHaveBeenCalledTimes(1);
    });
  },
};

export const DeleteAccountFailure: Story = {
  render: (args) => <SettingsJourney handlers={deleteFailureHandlers} onLogout={args.onLogout} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: /delete account/i }));
    await userEvent.type(body.getByLabelText(/^type delete to confirm$/i), 'DELETE');
    await userEvent.click(body.getByRole('button', { name: /delete forever/i }));
    await expect(body.getByText(/account deletion failed/i)).toBeVisible();
    await expect(body.getByRole('heading', { name: /delete account/i })).toBeVisible();
  },
};
