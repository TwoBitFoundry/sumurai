import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PasskeySecuritySection } from '@/features/settings/PasskeySecuritySection';
import { LAST_PASSKEY_REMOVE_TOOLTIP } from '@/features/settings/passkeySecurityPolicy';
import { pageLayoutRecipes } from '@/layouts/PageLayout';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import { Badge, cn, GlassCard } from '@/ui/primitives';
import {
  buildPasskeyEnrollFailureHandlers,
  buildPasskeyHandlers,
  buildPasskeyListFailureHandlers,
  storyPasskeysIPhone,
  storyPasskeysMacBook,
  withStoryWebAuthn,
} from './passkeyJourneyHandlers';
import { type StoryApiRoute, StoryApiScope } from './storyApi';

const meta = {
  title: 'App/Screens/User Journeys/Passkeys',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function PasskeysJourneyScreen({ handlers }: { handlers: StoryApiRoute[] }) {
  return (
    <StoryApiScope handlers={handlers}>
      <AuthenticatedScreenShell currentTab="settings">
        <div className={cn('px-4', 'py-8')}>
          <div className={cn(...pageLayoutRecipes.settingsShell)}>
            <GlassCard variant="default" padding="lg">
              <div className={cn('space-y-5')}>
                <Badge size="md">ACCOUNT SETTINGS</Badge>
                <PasskeySecuritySection />
              </div>
            </GlassCard>
          </div>
        </div>
      </AuthenticatedScreenShell>
    </StoryApiScope>
  );
}

export const Journey: Story = {
  render: () => (
    <PasskeysJourneyScreen
      handlers={buildPasskeyHandlers([storyPasskeysMacBook, storyPasskeysIPhone])}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await waitFor(() => {
      expect(canvas.getByRole('heading', { name: /security/i })).toBeVisible();
      expect(canvas.getByText('MacBook Pro')).toBeVisible();
      expect(canvas.getByText('iPhone')).toBeVisible();
    });

    await userEvent.click(canvas.getByRole('button', { name: /remove passkey iphone/i }));
    await expect(body.getByRole('heading', { name: /remove passkey/i })).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: /^remove passkey$/i }));

    await waitFor(() => {
      expect(canvas.queryByText('iPhone')).not.toBeInTheDocument();
      expect(canvas.getByText('MacBook Pro')).toBeVisible();
    });

    await userEvent.click(canvas.getByRole('button', { name: /add passkey/i }));
    await expect(body.getByRole('heading', { name: /add passkey/i })).toBeVisible();
    await userEvent.clear(body.getByLabelText(/passkey name/i));
    await userEvent.type(body.getByLabelText(/passkey name/i), 'iPad');

    await withStoryWebAuthn(async () => {
      await userEvent.click(body.getByRole('button', { name: /enroll passkey/i }));
      await waitFor(() => {
        expect(canvas.getByText('iPad')).toBeVisible();
      });
    });

    expect(body.queryByRole('heading', { name: /add passkey/i })).not.toBeInTheDocument();
  },
};

export const SinglePasskeyRemoveDisabled: Story = {
  render: () => <PasskeysJourneyScreen handlers={buildPasskeyHandlers([storyPasskeysMacBook])} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText('MacBook Pro')).toBeVisible();
    });

    const removeButton = canvas.getByRole('button', { name: /remove passkey macbook pro/i });
    expect(removeButton).toBeDisabled();
    expect(canvas.getByTitle(LAST_PASSKEY_REMOVE_TOOLTIP)).toBeTruthy();
  },
};

export const AddPasskeyCancel: Story = {
  render: () => <PasskeysJourneyScreen handlers={buildPasskeyHandlers([storyPasskeysMacBook])} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /add passkey/i })).toBeEnabled();
    });

    await userEvent.click(canvas.getByRole('button', { name: /add passkey/i }));
    await expect(body.getByRole('heading', { name: /add passkey/i })).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => {
      expect(body.queryByRole('heading', { name: /add passkey/i })).not.toBeInTheDocument();
    });
  },
};

export const AddPasskeySuccess: Story = {
  render: () => <PasskeysJourneyScreen handlers={buildPasskeyHandlers([storyPasskeysMacBook])} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: /add passkey/i }));
    await userEvent.clear(body.getByLabelText(/passkey name/i));
    await userEvent.type(body.getByLabelText(/passkey name/i), 'Work laptop');

    await withStoryWebAuthn(async () => {
      await userEvent.click(body.getByRole('button', { name: /enroll passkey/i }));
      await waitFor(() => {
        expect(canvas.getByText('Work laptop')).toBeVisible();
      });
    });
  },
};

export const RemovePasskeyConfirm: Story = {
  render: () => (
    <PasskeysJourneyScreen
      handlers={buildPasskeyHandlers([storyPasskeysMacBook, storyPasskeysIPhone])}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await waitFor(() => {
      expect(canvas.getByText('iPhone')).toBeVisible();
    });

    await userEvent.click(canvas.getByRole('button', { name: /remove passkey iphone/i }));
    await userEvent.click(body.getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => {
      expect(body.queryByRole('heading', { name: /remove passkey/i })).not.toBeInTheDocument();
      expect(canvas.getByText('iPhone')).toBeVisible();
    });

    await userEvent.click(canvas.getByRole('button', { name: /remove passkey iphone/i }));
    await userEvent.click(body.getByRole('button', { name: /^remove passkey$/i }));

    await waitFor(() => {
      expect(canvas.queryByText('iPhone')).not.toBeInTheDocument();
    });
  },
};

export const EnrollFailure: Story = {
  render: () => (
    <PasskeysJourneyScreen handlers={buildPasskeyEnrollFailureHandlers([storyPasskeysMacBook])} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: /add passkey/i }));

    await withStoryWebAuthn(async () => {
      await userEvent.click(body.getByRole('button', { name: /enroll passkey/i }));
      await waitFor(() => {
        expect(body.getByText(/passkey verification failed.*out of sync/i)).toBeVisible();
        expect(body.getByRole('heading', { name: /add passkey/i })).toBeVisible();
      });
    });

    expect(canvas.queryByText('Work laptop')).not.toBeInTheDocument();
  },
};

export const ListLoadFailure: Story = {
  render: () => <PasskeysJourneyScreen handlers={buildPasskeyListFailureHandlers()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText(/failed to load passkeys/i)).toBeVisible();
      expect(canvas.getByRole('heading', { name: /security/i })).toBeVisible();
    });
  },
};
