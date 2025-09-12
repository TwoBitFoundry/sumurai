import { AuthService } from './authService'

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message, 'AUTH_REQUIRED')
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Invalid input data', details?: Record<string, string>) {
    super(400, message, 'VALIDATION_ERROR')
    if (details) {
      this.details = details
    }
  }
  
  public details?: Record<string, string>
}

export class NetworkError extends ApiError {
  constructor(message = 'Network connection failed') {
    super(0, message, 'NETWORK_ERROR')
  }
}

export class ServerError extends ApiError {
  constructor(status: number, message = 'Server error occurred') {
    super(status, message, 'SERVER_ERROR')
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict') {
    super(409, message, 'CONFLICT')
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND')
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Access forbidden') {
    super(403, message, 'FORBIDDEN')
  }
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
  private static retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    retryableStatuses: [502, 503, 504, 429], // Bad Gateway, Service Unavailable, Gateway Timeout, Rate Limited
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
      const token = AuthService.getToken()
      
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      }

      const url = `${this.baseUrl}${endpoint}`
      
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Handle authentication errors with token refresh
      if (response.status === 401) {
        return this.handleAuthenticationError<T>(endpoint, options, attempt)
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const error = await this.createApiError(response)
        
        // Retry on retryable status codes
        if (this.isRetryableStatus(response.status) && attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt)
          await this.delay(delay)
          return this.makeRequestWithRetry<T>(endpoint, options, attempt + 1)
        }
        
        throw error
      }

      if (response.status === 204) {
        return {} as T
      }

      return response.json()
    } catch (error) {
      // Handle network errors
      if (error instanceof Error && this.isRetryableError(error) && attempt < this.retryConfig.maxRetries) {
        const delay = this.calculateBackoffDelay(attempt)
        await this.delay(delay)
        return this.makeRequestWithRetry<T>(endpoint, options, attempt + 1)
      }
      
      // Re-throw ApiError instances directly
      if (error instanceof ApiError || error instanceof AuthenticationError) {
        throw error
      }
      
      // Convert network errors to NetworkError after all retries are exhausted
      if (error instanceof Error && this.isRetryableError(error)) {
        throw new NetworkError(error.message)
      }
      
      // For other errors, throw as-is
      throw error
    }
  }

  private static async handleAuthenticationError<T>(
    endpoint: string,
    options: RequestInit,
    attempt: number
  ): Promise<T> {
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
    } catch (refreshError) {
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
        case 401:
          const authError = new AuthenticationError(errorMessage)
          // Override the default code if we got a specific one
          if (errorCode) {
            authError.code = errorCode
          }
          return authError
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
    // Health check doesn't need authentication, so bypass the normal flow
    const response = await fetch('/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new ApiError(response.status, 'Health check failed')
    }

    return response.text()
  }
}
