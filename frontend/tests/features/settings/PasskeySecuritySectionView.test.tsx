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

describe('PasskeySecuritySectionView', () => {
  it('disables remove when only one passkey is enrolled', () => {
    render(
      <PasskeySecuritySectionView
        passkeys={samplePasskeys}
        isLoading={false}
        bannerError={null}
        newPasskeyName="iPhone"
        isEnrolling={false}
        removeTarget={null}
        isRemoving={false}
        transients={[]}
        onNewPasskeyNameChange={noop}
        onAddPasskey={noop}
        onRequestRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onDismissTransient={noop}
      />
    );
    const removeButton = screen.getByRole('button', { name: /remove passkey macbook pro/i });
    expect(removeButton).toHaveProperty('disabled', true);
    expect(screen.getByTitle(LAST_PASSKEY_REMOVE_TOOLTIP)).toBeTruthy();
  });

  it('enables remove when multiple passkeys are enrolled', () => {
    render(
      <PasskeySecuritySectionView
        passkeys={[
          ...samplePasskeys,
          {
            id: 'pk-2',
            name: 'iPhone',
            created_at: '2026-02-01T00:00:00Z',
            last_used_at: null,
          },
        ]}
        isLoading={false}
        bannerError={null}
        newPasskeyName="iPad"
        isEnrolling={false}
        removeTarget={null}
        isRemoving={false}
        transients={[]}
        onNewPasskeyNameChange={noop}
        onAddPasskey={noop}
        onRequestRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onDismissTransient={noop}
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

  it('shows recovery guidance when no passkeys are listed', () => {
    render(
      <PasskeySecuritySectionView
        passkeys={[]}
        isLoading={false}
        bannerError={null}
        newPasskeyName=""
        isEnrolling={false}
        removeTarget={null}
        isRemoving={false}
        transients={[]}
        onNewPasskeyNameChange={noop}
        onAddPasskey={noop}
        onRequestRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onDismissTransient={noop}
      />
    );
    expect(screen.getByText(/no passkey enrolled/i)).toBeTruthy();
  });

  it('shows mid-enrollment label on the add button', () => {
    render(
      <PasskeySecuritySectionView
        passkeys={samplePasskeys}
        isLoading={false}
        bannerError={null}
        newPasskeyName="iPad"
        isEnrolling={true}
        removeTarget={null}
        isRemoving={false}
        transients={[]}
        onNewPasskeyNameChange={noop}
        onAddPasskey={noop}
        onRequestRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onDismissTransient={noop}
      />
    );
    expect(screen.getByRole('button', { name: /waiting for your device/i })).toHaveProperty(
      'disabled',
      true
    );
  });
});
