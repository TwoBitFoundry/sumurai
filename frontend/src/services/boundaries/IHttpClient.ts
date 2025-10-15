export interface IHttpClient {
  get<T>(endpoint: string): Promise<T>
  post<T>(endpoint: string, data?: unknown): Promise<T>
  put<T>(endpoint: string, data?: unknown): Promise<T>
  delete<T>(endpoint: string): Promise<T>
  healthCheck(): Promise<string>
}
