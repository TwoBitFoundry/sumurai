import { render, screen } from '@testing-library/react';
import { PasskeySecuritySectionView } from '@/features/settings/PasskeySecuritySectionView';
import { LAST_PASSKEY_REMOVE_TOOLTIP } from '@/features/settings/passkeySecurityPolicy';

const samplePasskeys = [
  {
    id: 'pk-1',
    name: 'MacBook Pro',
    created_at: '2026-01-10T00:00:00Z',
    last_used_at: '2026-03-01T00:00:00Z',
  },
];

const noop = () => {};

const baseProps = {
  passkeys: samplePasskeys,
  isLoading: false,
  bannerError: null,
  isAddModalOpen: false,
  addModalError: null,
  newPasskeyName: 'iPhone',
  isEnrolling: false,
  removeTarget: null,
  isRemoving: false,
  transients: [],
  onOpenAddModal: noop,
  onCancelAdd: noop,
  onNewPasskeyNameChange: noop,
  onConfirmAdd: noop,
  onRequestRemove: noop,
  onConfirmRemove: noop,
  onCancelRemove: noop,
  onDismissTransient: noop,
};

describe('PasskeySecuritySectionView', () => {
  it('disables remove when only one passkey is enrolled', () => {
    render(<PasskeySecuritySectionView {...baseProps} />);
    const removeButton = screen.getByRole('button', { name: /remove passkey macbook pro/i });
    expect(removeButton).toHaveProperty('disabled', true);
    expect(screen.getByTitle(LAST_PASSKEY_REMOVE_TOOLTIP)).toBeTruthy();
  });

  it('enables remove when multiple passkeys are enrolled', () => {
    render(
      <PasskeySecuritySectionView
        {...baseProps}
        passkeys={[
          ...samplePasskeys,
          {
            id: 'pk-2',
            name: 'iPhone',
            created_at: '2026-02-01T00:00:00Z',
            last_used_at: null,
          },
        ]}
        newPasskeyName="iPad"
      />
    );
    expect(screen.getByRole('button', { name: /remove passkey macbook pro/i })).toHaveProperty(
      'disabled',
      false
    );
    expect(screen.getByRole('button', { name: /remove passkey iphone/i })).toHaveProperty(
      'disabled',
      false
    );
  });

  it('keeps the passkey list visible while a background refresh is loading', () => {
    render(
      <PasskeySecuritySectionView
        {...baseProps}
        isLoading
        passkeys={[
          ...samplePasskeys,
          {
            id: 'pk-2',
            name: 'iPhone',
            created_at: '2026-02-01T00:00:00Z',
            last_used_at: null,
          },
        ]}
      />
    );
    expect(screen.getByRole('button', { name: /remove passkey iphone/i })).toBeTruthy();
    expect(screen.queryByText(/loading passkeys/i)).toBeNull();
  });

  it('shows recovery guidance when no passkeys are listed', () => {
    render(<PasskeySecuritySectionView {...baseProps} passkeys={[]} newPasskeyName="" />);
    expect(screen.getByText(/no passkey enrolled/i)).toBeTruthy();
  });

  it('opens add passkey flow in a modal', () => {
    const { rerender } = render(<PasskeySecuritySectionView {...baseProps} />);
    expect(screen.getByRole('button', { name: /^add passkey$/i })).toBeTruthy();

    rerender(<PasskeySecuritySectionView {...baseProps} isAddModalOpen />);
    expect(screen.getByRole('dialog', { name: /^add passkey$/i })).toBeTruthy();
    expect(screen.getByLabelText(/^passkey name$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /enroll passkey/i })).toBeTruthy();
  });

  it('shows mid-enrollment label in the add modal', () => {
    render(
      <PasskeySecuritySectionView {...baseProps} isAddModalOpen isEnrolling newPasskeyName="iPad" />
    );
    expect(screen.getByRole('button', { name: /waiting for your device/i })).toHaveProperty(
      'disabled',
      true
    );
  });
});
