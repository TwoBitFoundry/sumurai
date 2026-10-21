import { ApiError } from '@/services/ApiClient';

export const isProviderReconnectRequiredError = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.code === 'PROVIDER_CREDENTIALS_MISSING';
