import { AuthService } from './authService'
import type { IHttpClient } from './boundaries'
import { FetchHttpClient } from './boundaries'
import {
  ApiError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  ServerError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from './boundaries'

export {
  ApiError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  ServerError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
}

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  retryableStatuses: number[]
  retryableErrors: string[]
}

export class ApiClient {
  private static baseUrl = '/api'
  private static httpClient: IHttpClient = new FetchHttpClient()
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
      'Request aborted'
    ]
  }

  static configure(httpClient: IHttpClient): void {
    this.httpClient = httpClient
  }


  private static isRetryableError(error: Error): boolean {
    return this.retryConfig.retryableErrors.some(retryableError =>
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    )
  }

  // Testing helpers: allow tests to tweak retry behavior deterministically
  static setTestMaxRetries(maxRetries: number) {
    if (import.meta.env.MODE === 'test') {
      this.retryConfig.maxRetries = Math.max(0, Math.floor(maxRetries))
    }
  }

  private static isRetryableStatus(status: number): boolean {
    return this.retryConfig.retryableStatuses.includes(status)
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private static calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, attempt),
      this.retryConfig.maxDelay
    )
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * exponentialDelay
    return Math.floor(exponentialDelay + jitter)
  }

  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    return this.makeRequestWithRetry<T>(endpoint, options, 0)
  }

  private static async makeRequestWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    attempt: number
  ): Promise<T> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            headers[key] = value
          })
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([key, value]) => {
            headers[key] = value
          })
        } else {
          Object.assign(headers, options.headers)
        }
      }

      const token = AuthService.getToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const optionsWithAuth = {
        ...options,
        headers,
      }

      const response = await this.makeRawRequest<T>(endpoint, optionsWithAuth)
      return response
    } catch (error) {
      if (error instanceof AuthenticationError && attempt === 0) {
        return this.handleAuthenticationError<T>(endpoint, options, attempt)
      }

      if (error instanceof ApiError && this.isRetryableStatus(error.status) && attempt < this.retryConfig.maxRetries) {
        const delay = this.calculateBackoffDelay(attempt)
        await this.delay(delay)
        return this.makeRequestWithRetry<T>(endpoint, options, attempt + 1)
      }

      if (error instanceof Error && this.isRetryableError(error) && attempt < this.retryConfig.maxRetries) {
        const delay = this.calculateBackoffDelay(attempt)
        await this.delay(delay)
        return this.makeRequestWithRetry<T>(endpoint, options, attempt + 1)
      }

      if (error instanceof ApiError || error instanceof AuthenticationError) {
        throw error
      }

      if (error instanceof Error && this.isRetryableError(error)) {
        throw new NetworkError(error.message)
      }

      throw error
    }
  }

  private static async makeRawRequest<T>(
    endpoint: string,
    options: RequestInit
  ): Promise<T> {
    const method = (options.method || 'GET').toUpperCase()
    const body = options.body ? JSON.parse(options.body as string) : undefined
    const requestOptions = { headers: options.headers as Record<string, string> }

    try {
      const result = await (async () => {
        switch (method) {
          case 'GET':
            return this.httpClient.get<T>(endpoint, requestOptions)
          case 'POST':
            return this.httpClient.post<T>(endpoint, body, requestOptions)
          case 'PUT':
            return this.httpClient.put<T>(endpoint, body, requestOptions)
          case 'DELETE':
            return this.httpClient.delete<T>(endpoint, requestOptions)
          default:
            throw new Error(`Unsupported HTTP method: ${method}`)
        }
      })()

      return result
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw error
    }
  }

  private static async handleAuthenticationError<T>(
    endpoint: string,
    options: RequestInit,
    _attempt: number
  ): Promise<T> {
    // Don't try to refresh if we're already refreshing
    if (endpoint === '/auth/refresh') {
      AuthService.clearToken()
      throw new AuthenticationError()
    }

    try {
      // Attempt to refresh the token
      const refreshResult = await AuthService.refreshToken()
      AuthService.storeToken(refreshResult.token)

      // Retry the original request with the new token
      const newHeaders = {
        ...options.headers,
        Authorization: `Bearer ${refreshResult.token}`
      }

      return this.makeRequestWithRetry<T>(endpoint, { ...options, headers: newHeaders }, 0)
    } catch {
      // Token refresh failed, clear tokens and throw authentication error
      AuthService.clearToken()
      throw new AuthenticationError()
    }
  }

  private static async createApiError(response: Response): Promise<ApiError> {
    let errorMessage = 'Request failed'
    let errorCode: string | undefined
    
    try {
      const errorData = await response.json()
      
      // Try to extract error message from various possible fields
      if (errorData.message) {
        errorMessage = errorData.message
      } else if (errorData.error) {
        errorMessage = errorData.error
      } else if (errorData.detail) {
        errorMessage = errorData.detail
      } else if (errorData.msg) {
        errorMessage = errorData.msg
      } else if (typeof errorData === 'string') {
        errorMessage = errorData
      }
      
      // Extract error code if available
      if (errorData.code) {
        errorCode = errorData.code
      }
      
    } catch {
      // If JSON parsing fails, try to get text content
      try {
        const textContent = await response.clone().text()
        if (textContent && textContent.trim().length > 0 && textContent.length < 500) {
          errorMessage = textContent.trim()
        } else {
          errorMessage = `${response.status} ${response.statusText || 'Error'}`
        }
      } catch {
        // Use default message if both JSON and text parsing fail
        errorMessage = `${response.status} ${response.statusText || 'Error'}`
      }
    }
    
    // Return specific error types based on status code
    const error = (() => {
      switch (response.status) {
        case 400:
          return new ValidationError(errorMessage)
        case 401: {
          const authError = new AuthenticationError(errorMessage)
          // Override the default code if we got a specific one
          if (errorCode) {
            authError.code = errorCode
          }
          return authError
        }
        case 403:
          return new ForbiddenError(errorMessage)
        case 404:
          return new NotFoundError(errorMessage)
        case 409:
          return new ConflictError(errorMessage)
        case 500:
        case 502:
        case 503:
        case 504:
          return new ServerError(response.status, errorMessage)
        default:
          return new ApiError(response.status, errorMessage, errorCode)
      }
    })()
    
    // Set the error code if it was extracted
    if (errorCode) {
      error.code = errorCode
    }
    
    return error
  }

  static async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'GET' })
  }

  static async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  static async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  static async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' })
  }

  static async healthCheck(): Promise<string> {
    try {
      const result = await this.httpClient.get<string>('/health', {})
      return typeof result === 'string' ? result : 'OK'
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(0, 'Health check failed')
    }
  }
}
