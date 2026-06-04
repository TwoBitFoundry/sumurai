/**
 * HTTP transport contract for service clients.
 */

export interface RequestOptions {
  headers?: Record<string, string>;
}

export interface IHttpClient {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  getBlob(endpoint: string, options?: RequestOptions): Promise<{ blob: Blob; filename?: string }>;
  post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T>;
  postFormData<T>(endpoint: string, data: FormData, options?: RequestOptions): Promise<T>;
  put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  healthCheck(): Promise<string>;
}
