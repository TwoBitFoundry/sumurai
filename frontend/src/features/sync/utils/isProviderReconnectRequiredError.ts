import { ApiError } from '@/services/ApiClient';

export const TELLER_NO_LONGER_SUPPORTED = 'TELLER_NO_LONGER_SUPPORTED';

export const isTellerNoLongerSupportedError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === TELLER_NO_LONGER_SUPPORTED;

export const isProviderReconnectRequiredError = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  error.code === 'PROVIDER_CREDENTIALS_MISSING' &&
  !isTellerNoLongerSupportedError(error);
