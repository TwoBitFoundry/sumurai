/**
 * Authenticated HTTP client for the backend API.
 */

import { AuthService } from './authService';
import type { IHttpClient } from './boundaries';
import {
  ApiError,
  AuthenticationError,
  ConflictError,
  FetchHttpClient,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
} from './boundaries';

export {
  ApiError,
  AuthenticationError,
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
};

const NODE_ENV = typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;
const NEXT_PUBLIC_API_BASE =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_BASE : undefined;
export const DEFAULT_API_BASE = NEXT_PUBLIC_API_BASE || '/api';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatuses: number[];
  retryableErrors: string[];
}

export class ApiClient {
  private static httpClient: IHttpClient = new FetchHttpClient(DEFAULT_API_BASE);
  private static retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    retryableStatuses: [502, 503, 504],
    retryableErrors: [
      'Failed to fetch',
      'Request timeout',
      'The operation was aborted',
      'DNS resolution failed',
      'Network error',
      'Connection reset',
      'Request aborted',
    ],
  };

  static configure(httpClient: IHttpClient): void {
    ApiClient.httpClient = httpClient;
  }

  private static isRetryableError(error: Error): boolean {
    return ApiClient.retryConfig.retryableErrors.some((retryableError) =>
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    );
  }

  // Testing helpers: allow tests to tweak retry behavior deterministically
  static setTestMaxRetries(maxRetries: number) {
    if (NODE_ENV === 'test') {
      ApiClient.retryConfig.maxRetries = Math.max(0, Math.floor(maxRetries));
    }
  }

  private static isRetryableStatus(status: number): boolean {
    return ApiClient.retryConfig.retryableStatuses.includes(status);
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      ApiClient.retryConfig.baseDelay * 2 ** attempt,
      ApiClient.retryConfig.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.floor(exponentialDelay + jitter);
  }

  private static async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return ApiClient.makeRequestWithRetry<T>(endpoint, options, 0);
  }

  private static async makeRequestBlob(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ blob: Blob; filename?: string }> {
    return ApiClient.makeRequestWithRetryBlob(endpoint, options, 0);
  }

  private static async makeRequestWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    attempt: number
  ): Promise<T> {
    try {
      const isFormData = options.body instanceof FormData;
      const headers: Record<string, string> = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      };

      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, options.headers);
        }
      }

      const optionsWithAuth = {
        ...options,
        headers,
      };

      const response = await ApiClient.makeRawRequest<T>(endpoint, optionsWithAuth);
      return response;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        if (attempt === 0) {
          return ApiClient.handleAuthenticationError<T>(endpoint, options, attempt);
        }
        AuthService.clearToken();
        throw error;
      }

      if (
        error instanceof ForbiddenError &&
        error.code === 'passkey_enrollment_required' &&
        typeof window !== 'undefined'
      ) {
        window.dispatchEvent(new CustomEvent('sumurai:enrollment-required'));
      }

      if (
        error instanceof ApiError &&
        ApiClient.isRetryableStatus(error.status) &&
        attempt < ApiClient.retryConfig.maxRetries
      ) {
        const delay = ApiClient.calculateBackoffDelay(attempt);
        await ApiClient.delay(delay);
        return ApiClient.makeRequestWithRetry<T>(endpoint, options, attempt + 1);
      }

      if (
        error instanceof Error &&
        ApiClient.isRetryableError(error) &&
        attempt < ApiClient.retryConfig.maxRetries
      ) {
        const delay = ApiClient.calculateBackoffDelay(attempt);
        await ApiClient.delay(delay);
        return ApiClient.makeRequestWithRetry<T>(endpoint, options, attempt + 1);
      }

      if (error instanceof ApiError || error instanceof AuthenticationError) {
        throw error;
      }

      if (error instanceof Error && ApiClient.isRetryableError(error)) {
        throw new NetworkError(error.message);
      }

      throw error;
    }
  }

  private static async makeRequestWithRetryBlob(
    endpoint: string,
    options: RequestInit,
    attempt: number
  ): Promise<{ blob: Blob; filename?: string }> {
    try {
      const headers: Record<string, string> = {};

      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, options.headers);
        }
      }

      const optionsWithAuth = {
        ...options,
        headers,
      };

      return await ApiClient.makeRawBlobRequest(endpoint, optionsWithAuth);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        if (attempt === 0) {
          return ApiClient.handleAuthenticationErrorBlob(endpoint, options, attempt);
        }
        AuthService.clearToken();
        throw error;
      }

      if (
        error instanceof ForbiddenError &&
        error.code === 'passkey_enrollment_required' &&
        typeof window !== 'undefined'
      ) {
        window.dispatchEvent(new CustomEvent('sumurai:enrollment-required'));
      }

      if (
        error instanceof ApiError &&
        ApiClient.isRetryableStatus(error.status) &&
        attempt < ApiClient.retryConfig.maxRetries
      ) {
        const delay = ApiClient.calculateBackoffDelay(attempt);
        await ApiClient.delay(delay);
        return ApiClient.makeRequestWithRetryBlob(endpoint, options, attempt + 1);
      }

      if (
        error instanceof Error &&
        ApiClient.isRetryableError(error) &&
        attempt < ApiClient.retryConfig.maxRetries
      ) {
        const delay = ApiClient.calculateBackoffDelay(attempt);
        await ApiClient.delay(delay);
        return ApiClient.makeRequestWithRetryBlob(endpoint, options, attempt + 1);
      }

      if (error instanceof ApiError || error instanceof AuthenticationError) {
        throw error;
      }

      if (error instanceof Error && ApiClient.isRetryableError(error)) {
        throw new NetworkError(error.message);
      }

      throw error;
    }
  }

  private static async makeRawRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const requestOptions = { headers: options.headers as Record<string, string> };
    const body = options.body;

    try {
      const result = await (async () => {
        switch (method) {
          case 'GET':
            return ApiClient.httpClient.get<T>(endpoint, requestOptions);
          case 'POST':
            if (body instanceof FormData) {
              return ApiClient.httpClient.postFormData<T>(endpoint, body, requestOptions);
            }
            return ApiClient.httpClient.post<T>(
              endpoint,
              body ? JSON.parse(body as string) : undefined,
              requestOptions
            );
          case 'PUT':
            return ApiClient.httpClient.put<T>(
              endpoint,
              body ? JSON.parse(body as string) : undefined,
              requestOptions
            );
          case 'DELETE':
            return ApiClient.httpClient.delete<T>(endpoint, requestOptions);
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }
      })();

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw error;
    }
  }

  private static async makeRawBlobRequest(
    endpoint: string,
    options: RequestInit
  ): Promise<{ blob: Blob; filename?: string }> {
    const method = (options.method || 'GET').toUpperCase();
    const requestOptions = { headers: options.headers as Record<string, string> };

    try {
      const result = await (async () => {
        switch (method) {
          case 'GET':
            return ApiClient.httpClient.getBlob(endpoint, requestOptions);
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }
      })();

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw error;
    }
  }

  private static async handleAuthenticationError<T>(
    endpoint: string,
    options: RequestInit,
    _attempt: number
  ): Promise<T> {
    // Don't try to refresh if we're already refreshing
    if (endpoint === '/auth/refresh') {
      AuthService.clearToken();
      throw new AuthenticationError();
    }

    if (endpoint === '/auth/passkey/login/finish') {
      AuthService.clearToken();
      throw new AuthenticationError();
    }

    try {
      await AuthService.refreshToken();
      return await ApiClient.makeRawRequest<T>(endpoint, options);
    } catch {
      AuthService.clearToken();
      throw new AuthenticationError();
    }
  }

  private static async handleAuthenticationErrorBlob(
    endpoint: string,
    options: RequestInit,
    _attempt: number
  ): Promise<{ blob: Blob; filename?: string }> {
    if (endpoint === '/auth/refresh' || endpoint === '/auth/passkey/login/finish') {
      AuthService.clearToken();
      throw new AuthenticationError();
    }

    try {
      await AuthService.refreshToken();
      return await ApiClient.makeRawBlobRequest(endpoint, options);
    } catch {
      AuthService.clearToken();
      throw new AuthenticationError();
    }
  }

  static async get<T>(endpoint: string): Promise<T> {
    return ApiClient.makeRequest<T>(endpoint, { method: 'GET' });
  }

  static async getBlob(endpoint: string): Promise<{ blob: Blob; filename?: string }> {
    return ApiClient.makeRequestBlob(endpoint, { method: 'GET' });
  }

  static async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return ApiClient.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async postFormData<T>(endpoint: string, data: FormData): Promise<T> {
    return ApiClient.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data,
    });
  }

  static async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return ApiClient.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async delete<T>(endpoint: string): Promise<T> {
    return ApiClient.makeRequest<T>(endpoint, { method: 'DELETE' });
  }

  static async healthCheck(): Promise<string> {
    try {
      const result = await ApiClient.httpClient.get<string>('/health', {});
      return typeof result === 'string' ? result : 'OK';
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, 'Health check failed');
    }
  }
}
