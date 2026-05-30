import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { PasskeySecuritySectionView } from '@/features/settings/PasskeySecuritySectionView';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';

const basePasskeys = [
  {
    id: 'pk-1',
    name: 'MacBook Pro',
    created_at: '2026-01-10T00:00:00Z',
    last_used_at: '2026-03-15T08:00:00Z',
  },
];

const meta = {
  title: 'App/Settings/PasskeySecurity',
  component: PasskeySecuritySectionView,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    passkeys: basePasskeys,
    isLoading: false,
    bannerError: null,
    isAddModalOpen: false,
    addModalError: null,
    newPasskeyName: 'MacBook Pro',
    isEnrolling: false,
    removeTarget: null,
    isRemoving: false,
    transients: [],
    onOpenAddModal: fn(),
    onCancelAdd: fn(),
    onNewPasskeyNameChange: fn(),
    onConfirmAdd: fn(),
    onRequestRemove: fn(),
    onConfirmRemove: fn(),
    onCancelRemove: fn(),
    onDismissTransient: fn(),
  },
} satisfies Meta<typeof PasskeySecuritySectionView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SinglePasskeyRemoveDisabled: Story = {};

export const MultiplePasskeys: Story = {
  args: {
    passkeys: [
      ...basePasskeys,
      {
        id: 'pk-2',
        name: 'iPhone',
        created_at: '2026-02-01T00:00:00Z',
        last_used_at: '2026-03-14T18:30:00Z',
      },
    ],
    newPasskeyName: 'iPad',
  },
};

export const AddPasskeyModal: Story = {
  args: {
    isAddModalOpen: true,
    newPasskeyName: 'Work laptop',
  },
};

export const MidEnrollment: Story = {
  args: {
    isAddModalOpen: true,
    isEnrolling: true,
    newPasskeyName: 'Work laptop',
  },
};

export const AddModalEnrollmentError: Story = {
  args: {
    isAddModalOpen: true,
    addModalError: 'Passkey verification failed. Try again on this device.',
    newPasskeyName: 'iPad',
  },
};

export const CeremonyCancelled: Story = {
  args: {
    isAddModalOpen: true,
    transients: [
      {
        id: 'toast-1',
        message: 'Passkey setup was cancelled. You can try again when ready.',
        type: 'error',
      },
    ],
  },
};

export const SinglePasskeyDark: Story = {
  ...storyDarkTheme,
};
