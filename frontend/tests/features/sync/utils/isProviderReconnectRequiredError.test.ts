import { describe, expect, it } from 'bun:test';
import { isProviderReconnectRequiredError } from '@/features/sync/utils/isProviderReconnectRequiredError';
import { ApiError, AuthenticationError, NotFoundError } from '@/services/ApiClient';

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
});
