import {
  canRemovePasskey,
  formatPasskeyTimestamp,
  LAST_PASSKEY_REMOVE_TOOLTIP,
  passkeyIdsEqual,
} from '@/features/settings/passkeySecurityPolicy';

describe('passkeySecurityPolicy', () => {
  it('disallows removing the only enrolled passkey', () => {
    expect(canRemovePasskey(1)).toBe(false);
    expect(canRemovePasskey(0)).toBe(false);
  });

  it('allows removing a passkey when more than one is enrolled', () => {
    expect(canRemovePasskey(2)).toBe(true);
  });

  it('exposes the last-passkey remove tooltip copy', () => {
    expect(LAST_PASSKEY_REMOVE_TOOLTIP).toContain('Enroll another passkey');
  });

  it('compares passkey ids case-insensitively', () => {
    expect(
      passkeyIdsEqual(
        'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      )
    ).toBe(true);
    expect(passkeyIdsEqual('pk-1', 'pk-2')).toBe(false);
  });

  it('formats passkey timestamps for display', () => {
    expect(formatPasskeyTimestamp('2026-03-15T12:00:00Z')).toMatch(/Mar/);
    expect(formatPasskeyTimestamp(null)).toBe('Never');
    expect(formatPasskeyTimestamp(undefined)).toBe('Never');
  });
});
