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
  ServerError,
  ValidationError,
} from './boundaries';

export {
  ApiError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  ServerError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
};

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

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
    retryableStatuses: [502, 503, 504, 429],
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
    if (process.env.NODE_ENV === 'test') {
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

  private static async makeRequestWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    attempt: number
  ): Promise<T> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
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

      const token = AuthService.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const optionsWithAuth = {
        ...options,
        headers,
      };

      const response = await ApiClient.makeRawRequest<T>(endpoint, optionsWithAuth);
      return response;
    } catch (error) {
      if (error instanceof AuthenticationError && attempt === 0) {
        return ApiClient.handleAuthenticationError<T>(endpoint, options, attempt);
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

  private static async makeRawRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    const requestOptions = { headers: options.headers as Record<string, string> };

    try {
      const result = await (async () => {
        switch (method) {
          case 'GET':
            return ApiClient.httpClient.get<T>(endpoint, requestOptions);
          case 'POST':
            return ApiClient.httpClient.post<T>(endpoint, body, requestOptions);
          case 'PUT':
            return ApiClient.httpClient.put<T>(endpoint, body, requestOptions);
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

    try {
      // Attempt to refresh the token
      const refreshResult = await AuthService.refreshToken();
      AuthService.storeToken(refreshResult.token);

      // Retry the original request with the new token
      const newHeaders = {
        ...options.headers,
        Authorization: `Bearer ${refreshResult.token}`,
      };

      return ApiClient.makeRequestWithRetry<T>(endpoint, { ...options, headers: newHeaders }, 0);
    } catch {
      // Token refresh failed, clear tokens and throw authentication error
      AuthService.clearToken();
      throw new AuthenticationError();
    }
  }

  static async get<T>(endpoint: string): Promise<T> {
    return ApiClient.makeRequest<T>(endpoint, { method: 'GET' });
  }

  static async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return ApiClient.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
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
