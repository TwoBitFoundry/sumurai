import { describe, expect, it } from 'bun:test';
import {
  isProviderReconnectRequiredError,
  isTellerNoLongerSupportedError,
} from '@/features/sync/utils/isProviderReconnectRequiredError';
import {
  ApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '@/services/ApiClient';

describe('isProviderReconnectRequiredError', () => {
  it('returns true when the API exposes a provider credentials error code', () => {
    expect(
      isProviderReconnectRequiredError(
        new ApiError(
          404,
          'This institution is linked in Sumurai but provider credentials are missing.',
          'PROVIDER_CREDENTIALS_MISSING'
        )
      )
    ).toBe(true);
  });

  it('returns false for app auth failures', () => {
    expect(isProviderReconnectRequiredError(new AuthenticationError('Session expired'))).toBe(
      false
    );
    expect(isProviderReconnectRequiredError(new ApiError(403, 'Forbidden', 'FORBIDDEN'))).toBe(
      false
    );
  });

  it('returns false for unrelated not-found responses', () => {
    expect(isProviderReconnectRequiredError(new NotFoundError('Connection not found'))).toBe(false);
    expect(
      isProviderReconnectRequiredError(
        new NotFoundError(
          'This institution is linked in Sumurai but provider credentials are missing. Reconnect your financial provider from Accounts.'
        )
      )
    ).toBe(false);
  });

  it('returns false for Teller sunset responses', () => {
    const error = new ValidationError(
      'Teller is no longer supported because the provider no longer offers API access.',
      { code: 'TELLER_NO_LONGER_SUPPORTED' },
      'TELLER_NO_LONGER_SUPPORTED'
    );
    expect(isTellerNoLongerSupportedError(error)).toBe(true);
    expect(isProviderReconnectRequiredError(error)).toBe(false);
  });
});
