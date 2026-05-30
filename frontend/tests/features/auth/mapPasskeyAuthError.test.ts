import { expect } from 'bun:test';
import { mapPasskeyAuthError } from '@/features/auth/utils/mapPasskeyAuthError';
import {
  ApiError,
  AuthenticationError,
  ConflictError,
  NetworkError,
} from '@/services/boundaries/errors';

describe('mapPasskeyAuthError', () => {
  it('maps ceremony cancellation to a toast for login', () => {
    const result = mapPasskeyAuthError(new Error('The operation was cancelled'), 'login');
    expect(result.bannerMessage).toBeNull();
    expect(result.toastMessage).toContain('cancelled');
  });

  it('maps login authentication errors to a banner message', () => {
    const result = mapPasskeyAuthError(new AuthenticationError('Authentication failed'), 'login');
    expect(result.bannerMessage).toContain('Sign-in failed');
    expect(result.toastMessage).toBeNull();
  });

  it('maps verification failures to a banner message', () => {
    const result = mapPasskeyAuthError(new ApiError(400, 'Passkey verification failed'), 'login');
    expect(result.bannerMessage).toContain('verification failed');
    expect(result.toastMessage).toBeNull();
  });

  it('maps network errors to a toast', () => {
    const result = mapPasskeyAuthError(new NetworkError(), 'register');
    expect(result.bannerMessage).toBeNull();
    expect(result.toastMessage).toContain('Network error');
  });

  it('maps email conflicts to a banner message', () => {
    const result = mapPasskeyAuthError(new ConflictError('Email already exists'), 'register');
    expect(result.bannerMessage).toContain('already exists');
    expect(result.toastMessage).toBeNull();
  });
});
