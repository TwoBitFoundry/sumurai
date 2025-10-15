import { IHttpClient } from './IHttpClient'
import {
  ApiError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  ServerError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from './errors'

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  retryableStatuses: number[]
  retryableErrors: string[]
}

export class FetchHttpClient implements IHttpClient {
  private baseUrl = '/api'
  private retryConfig: RetryConfig = {
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

  private isRetryableError(error: Error): boolean {
    return this.retryConfig.retryableErrors.some(retryableError =>
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    )
  }

  private isRetryableStatus(status: number): boolean {
    return this.retryConfig.retryableStatuses.includes(status)
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, attempt),
      this.retryConfig.maxDelay
    )

    const jitter = Math.random() * 0.3 * exponentialDelay
    return Math.floor(exponentialDelay + jitter)
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    return this.makeRequestWithRetry<T>(endpoint, options, 0)
  }

  private async makeRequestWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    attempt: number
  ): Promise<T> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      }

      const url = `${this.baseUrl}${endpoint}`

      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const error = await this.createApiError(response)

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

  private async createApiError(response: Response): Promise<ApiError> {
    let errorMessage = 'Request failed'
    let errorCode: string | undefined

    try {
      const errorData = await response.json()

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

      if (errorData.code) {
        errorCode = errorData.code
      }

    } catch {
      try {
        const textContent = await response.clone().text()
        if (textContent && textContent.trim().length > 0 && textContent.length < 500) {
          errorMessage = textContent.trim()
        } else {
          errorMessage = `${response.status} ${response.statusText || 'Error'}`
        }
      } catch {
        errorMessage = `${response.status} ${response.statusText || 'Error'}`
      }
    }

    const error = (() => {
      switch (response.status) {
        case 400:
          return new ValidationError(errorMessage)
        case 401:
          const authError = new AuthenticationError(errorMessage)
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

    if (errorCode) {
      error.code = errorCode
    }

    return error
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' })
  }

  async healthCheck(): Promise<string> {
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
