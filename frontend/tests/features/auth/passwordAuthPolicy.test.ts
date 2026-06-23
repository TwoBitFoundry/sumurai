import { afterEach, describe, expect, it } from 'bun:test';
import { isPasswordAuthEnabled } from '@/features/auth/passwordAuthPolicy';

describe('passwordAuthPolicy', () => {
  const originalValue = process.env.NEXT_PUBLIC_PASSWORD_AUTH;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_PASSWORD_AUTH;
    } else {
      process.env.NEXT_PUBLIC_PASSWORD_AUTH = originalValue;
    }
  });

  it('returns true when NEXT_PUBLIC_PASSWORD_AUTH is true', () => {
    process.env.NEXT_PUBLIC_PASSWORD_AUTH = 'true';
    expect(isPasswordAuthEnabled()).toBe(true);
  });

  it('returns false when NEXT_PUBLIC_PASSWORD_AUTH is unset or false', () => {
    delete process.env.NEXT_PUBLIC_PASSWORD_AUTH;
    expect(isPasswordAuthEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_PASSWORD_AUTH = 'false';
    expect(isPasswordAuthEnabled()).toBe(false);
  });
});
