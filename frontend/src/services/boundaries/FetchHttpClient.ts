import {
  ApiError,
  AuthenticationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
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

export class FetchHttpClient implements IHttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
      if (response.status === 204) return {} as T;
      return response.json();
    }

    const error = await this.createApiError(response);
    throw error;
  }

  private async createApiError(response: Response): Promise<ApiError> {
    let errorMessage = 'Request failed';

    try {
      const errorData = await response.json();
      if (errorData.message) errorMessage = errorData.message;
      else if (errorData.error) errorMessage = errorData.error;
      else if (errorData.detail) errorMessage = errorData.detail;
    } catch {
      errorMessage = `${response.status} ${response.statusText || 'Error'}`;
    }

    switch (response.status) {
      case 400:
        return new ValidationError(errorMessage);
      case 401:
        return new AuthenticationError(errorMessage);
      case 403:
        return new ForbiddenError(errorMessage);
      case 404:
        return new NotFoundError(errorMessage);
      case 409:
        return new ConflictError(errorMessage);
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
    const response = await fetch(url, { method: 'GET', headers });
    return this.handleResponse<T>(response);
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
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = buildUrl(this.baseUrl, endpoint);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    const response = await fetch(url, { method: 'DELETE', headers });
    return this.handleResponse<T>(response);
  }

  async healthCheck(): Promise<string> {
    const response = await fetch(buildUrl(this.baseUrl, '/health'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Health check failed`);
    return response.text();
  }
}
