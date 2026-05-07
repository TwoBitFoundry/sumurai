import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import SettingsPage from '@/views/SettingsPage';
import { jsonResponse, route, StoryApiScope } from './storyApi';

const meta = {
  title: 'App/Screens/User Journeys/Settings',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const handlers = [
  route('PUT', '/auth/change-password', () =>
    jsonResponse({ message: 'Password updated successfully.' })
  ),
];

function SettingsJourney() {
  return (
    <StoryApiScope handlers={handlers}>
      <SettingsPage />
    </StoryApiScope>
  );
}

export const Journey: Story = {
  render: () => <SettingsJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await waitFor(() => {
      expect(canvas.getByRole('heading', { name: /change password/i })).toBeVisible();
    });

    await userEvent.type(canvas.getByLabelText(/^current password$/i), 'Current123!');
    await userEvent.type(canvas.getByLabelText(/^new password$/i), 'StrongPass1!');
    await userEvent.type(canvas.getByLabelText(/^confirm new password$/i), 'Mismatch1!');
    await userEvent.click(canvas.getByRole('button', { name: /change password/i }));
    await expect(canvas.getByText(/passwords do not match/i)).toBeVisible();

    await userEvent.clear(canvas.getByLabelText(/^confirm new password$/i));
    await userEvent.type(canvas.getByLabelText(/^confirm new password$/i), 'StrongPass1!');
    await userEvent.click(canvas.getByRole('button', { name: /change password/i }));
    await expect(canvas.getByText(/password updated successfully/i)).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: /delete account/i }));
    await userEvent.type(body.getByLabelText(/^type delete to confirm$/i), 'DELETE');
    const deleteForever = body.getByRole('button', { name: /delete forever/i });
    await expect(deleteForever).toBeEnabled();
  },
};
