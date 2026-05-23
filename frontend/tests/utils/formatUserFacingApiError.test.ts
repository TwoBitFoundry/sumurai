import { ApiError, RateLimitError } from '@/services/ApiClient';
import { formatUserFacingApiError } from '@/utils/formatUserFacingApiError';

describe('formatUserFacingApiError', () => {
  it('formats rate limit errors with retry guidance', () => {
    const message = formatUserFacingApiError(
      new RateLimitError(
        'SimpleFIN allows about one sync per hour for this account. Try again later.',
        3600
      ),
      'Failed to sync bank'
    );

    expect(message).toContain('SimpleFIN allows about one sync per hour');
    expect(message).toContain('Try again in about 1 hour');
  });

  it('rewrites legacy connection-not-found sync errors', () => {
    const message = formatUserFacingApiError(
      new ApiError(404, 'Connection not found'),
      'Failed to sync bank'
    );

    expect(message).toContain('not linked to your account');
    expect(message).toContain('HTTP 404');
  });

  it('includes HTTP status when the API message is specific', () => {
    const message = formatUserFacingApiError(
      new ApiError(404, 'This institution is not linked to your account.'),
      'Failed to sync bank'
    );

    expect(message).toBe('This institution is not linked to your account. (HTTP 404)');
  });

  it('falls back with status when the API message is generic', () => {
    const message = formatUserFacingApiError(
      new ApiError(502, '502 Bad Gateway'),
      'Failed to sync bank'
    );

    expect(message).toBe('Failed to sync bank (HTTP 502)');
  });
});
