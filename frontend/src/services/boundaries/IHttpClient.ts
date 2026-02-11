export interface RequestOptions {
  headers?: Record<string, string>;
}

export interface IHttpClient {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  healthCheck(): Promise<string>;
}
