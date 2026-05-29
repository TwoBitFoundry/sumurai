import {
  ApiError,
  AuthenticationError,
  ConflictError,
  NetworkError,
} from '@/services/boundaries/errors';

export type PasskeyAuthFlow = 'login' | 'register' | 'enroll';

export type PasskeyAuthErrorPresentation = {
  bannerMessage: string | null;
  toastMessage: string | null;
};

function isCeremonyCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return (
    normalized.includes('cancel') ||
    normalized.includes('abort') ||
    normalized.includes('notallowed') ||
    error.name === 'NotAllowedError'
  );
}

function isVerificationFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return (
    error.status === 400 &&
    (normalized.includes('verification') ||
      normalized.includes('counter') ||
      normalized.includes('challenge'))
  );
}

export function mapPasskeyAuthError(
  error: unknown,
  flow: PasskeyAuthFlow
): PasskeyAuthErrorPresentation {
  if (isCeremonyCancelled(error)) {
    const toastMessage =
      flow === 'login'
        ? 'Passkey sign-in was cancelled. You can try again when ready.'
        : 'Passkey setup was cancelled. You can try again when ready.';
    return { bannerMessage: null, toastMessage };
  }

  if (error instanceof NetworkError || (error instanceof ApiError && error.status === 0)) {
    return {
      bannerMessage: null,
      toastMessage: 'Network error. Check your connection and try again.',
    };
  }

  if (error instanceof ConflictError || (error instanceof ApiError && error.status === 409)) {
    return {
      bannerMessage: 'An account with this email already exists.',
      toastMessage: null,
    };
  }

  if (
    flow === 'login' &&
    (error instanceof AuthenticationError || (error instanceof ApiError && error.status === 401))
  ) {
    return {
      bannerMessage: 'Sign-in failed. Check your email and password, or create a new account.',
      toastMessage: null,
    };
  }

  if (
    flow === 'enroll' &&
    (error instanceof AuthenticationError || (error instanceof ApiError && error.status === 401))
  ) {
    return {
      bannerMessage:
        'Your session expired. Sign in with your password from the home page, then enroll your passkey.',
      toastMessage: null,
    };
  }

  if (isVerificationFailure(error)) {
    return {
      bannerMessage:
        'Passkey verification failed. Your device may be out of sync — try again or use another enrolled passkey.',
      toastMessage: null,
    };
  }

  if (error instanceof ApiError && error.status >= 500) {
    return {
      bannerMessage: null,
      toastMessage: 'Server error. Please try again in a moment.',
    };
  }

  if (error instanceof Error) {
    return {
      bannerMessage: error.message,
      toastMessage: null,
    };
  }

  return {
    bannerMessage: 'Something went wrong. Please try again.',
    toastMessage: null,
  };
}
