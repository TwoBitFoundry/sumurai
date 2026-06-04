/**
 * Fetch implementation of the HTTP transport contract.
 */

import {
  ApiError,
  AuthenticationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
} from './errors';
import type { IHttpClient, RequestOptions } from './IHttpClient';

const normalizeBaseUrl = (baseUrl?: string): string => {
  if (!baseUrl) return '/api';
  const trimmed = baseUrl.replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : '/api';
};

const buildUrl = (baseUrl: string, endpoint: string): string => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
};

const apiFetchCredentials: RequestCredentials = 'include';
const apiFetchCache: RequestCache = 'no-store';

const parseFilenameFromContentDisposition = (
  contentDisposition: string | null
): string | undefined => {
  if (!contentDisposition) {
    return undefined;
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const unquotedMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (unquotedMatch?.[1]) {
    return unquotedMatch[1].trim();
  }

  return undefined;
};

export class FetchHttpClient implements IHttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
      if (response.status === 204) return {} as T;
      const text = await response.text();
      if (text.length === 0) return {} as T;
      return JSON.parse(text) as T;
    }

    const error = await this.createApiError(response);
    throw error;
  }

  private async handleBlobResponse(response: Response): Promise<{ blob: Blob; filename?: string }> {
    if (response.ok) {
      return {
        blob: await response.blob(),
        filename: parseFilenameFromContentDisposition(response.headers.get('Content-Disposition')),
      };
    }

    const error = await this.createApiError(response);
    throw error;
  }

  private parseRetryAfterSeconds(response: Response): number | undefined {
    const header = response.headers.get('Retry-After');
    if (!header) {
      return undefined;
    }

    const seconds = Number.parseInt(header, 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  }

  private async createApiError(response: Response): Promise<ApiError> {
    let errorMessage = 'Request failed';
    let errorData: unknown;

    try {
      errorData = await response.json();
      if (
        errorData &&
        typeof errorData === 'object' &&
        'message' in errorData &&
        typeof (errorData as { message: unknown }).message === 'string'
      ) {
        errorMessage = (errorData as { message: string }).message;
      } else if (
        errorData &&
        typeof errorData === 'object' &&
        'error' in errorData &&
        typeof (errorData as { error: unknown }).error === 'string'
      ) {
        errorMessage = (errorData as { error: string }).error;
      } else if (
        errorData &&
        typeof errorData === 'object' &&
        'detail' in errorData &&
        typeof (errorData as { detail: unknown }).detail === 'string'
      ) {
        errorMessage = (errorData as { detail: string }).detail;
      }
    } catch {
      errorMessage = `${response.status} ${response.statusText || 'Error'}`;
    }

    const errorCode =
      errorData &&
      typeof errorData === 'object' &&
      'code' in errorData &&
      typeof (errorData as { code: unknown }).code === 'string'
        ? (errorData as { code: string }).code
        : undefined;

    switch (response.status) {
      case 400:
      case 422:
        return new ValidationError(errorMessage, errorData);
      case 401:
        return new AuthenticationError(errorMessage);
      case 403:
        return new ForbiddenError(errorMessage, errorCode ?? 'FORBIDDEN');
      case 404:
        return new NotFoundError(errorMessage);
      case 409:
        return new ConflictError(errorMessage, errorData);
      case 429:
        return new RateLimitError(errorMessage, this.parseRetryAfterSeconds(response));
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServerError(response.status, errorMessage);
      default:
        return new ApiError(response.status, errorMessage);
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = buildUrl(this.baseUrl, endpoint);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: apiFetchCredentials,
      cache: apiFetchCache,
    });
    return this.handleResponse<T>(response);
  }

  async getBlob(
    endpoint: string,
    options?: RequestOptions
  ): Promise<{ blob: Blob; filename?: string }> {
    const url = buildUrl(this.baseUrl, endpoint);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: apiFetchCredentials,
      cache: apiFetchCache,
    });
    return this.handleBlobResponse(response);
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const url = buildUrl(this.baseUrl, endpoint);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: apiFetchCredentials,
      cache: apiFetchCache,
    });
    return this.handleResponse<T>(response);
  }

  async postFormData<T>(endpoint: string, data: FormData, options?: RequestOptions): Promise<T> {
    const url = buildUrl(this.baseUrl, endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: options?.headers,
      body: data,
      credentials: apiFetchCredentials,
      cache: apiFetchCache,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const url = buildUrl(this.baseUrl, endpoint);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: apiFetchCredentials,
      cache: apiFetchCache,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = buildUrl(this.baseUrl, endpoint);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      credentials: apiFetchCredentials,
      cache: apiFetchCache,
    });
    return this.handleResponse<T>(response);
  }

  async healthCheck(): Promise<string> {
    const response = await fetch(buildUrl(this.baseUrl, '/health'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: apiFetchCredentials,
    });
    if (!response.ok) throw new Error(`Health check failed`);
    return response.text();
  }
}
