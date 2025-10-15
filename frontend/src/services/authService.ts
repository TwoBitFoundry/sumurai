import type { IHttpClient } from './boundaries'
import type { IStorageAdapter } from './boundaries'
import { FetchHttpClient, BrowserStorageAdapter } from './boundaries'

interface LoginCredentials {
  email: string
  password: string
}

interface RegisterCredentials {
  email: string
  password: string
}

interface AuthResponse {
  token: string
  user_id: string
  expires_at: string
  onboarding_completed: boolean
}

interface RefreshResponse {
  token: string
  user_id: string
  expires_at: string
  onboarding_completed: boolean
}

interface RegisterResponse {
  message: string
}

interface LogoutResponse {
  message: string
  cleared_session: string
}

interface AuthServiceDependencies {
  http: IHttpClient
  storage: IStorageAdapter
}

export class AuthService {
  private static refreshPromise: Promise<RefreshResponse> | null = null
  private static deps: AuthServiceDependencies

  static configure(deps: AuthServiceDependencies): void {
    this.deps = deps
  }

  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      return await this.deps.http.post<AuthResponse>('/auth/login', credentials)
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          throw new Error('Invalid email or password')
        }
        if (error.message.includes('500')) {
          throw new Error('Server error. Please try again later.')
        }
      }
      throw error
    }
  }
  
  static storeToken(token: string, refreshToken?: string): void {
    this.deps.storage.setItem('auth_token', token)
    if (refreshToken) {
      this.deps.storage.setItem('refresh_token', refreshToken)
    }
  }

  static getToken(): string | null {
    return this.deps.storage.getItem('auth_token')
  }

  static clearToken(): void {
    this.deps.storage.removeItem('auth_token')
    this.deps.storage.removeItem('refresh_token')
    localStorage.removeItem('plaid_user_id')
    this.refreshPromise = null
  }

  static async validateSession(): Promise<boolean> {
    const token = this.getToken()
    if (!token) {
      return false
    }

    try {
      await this.deps.http.get('/providers/status')
      return true
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        this.clearToken()
        return false
      }
      console.warn('Session validation failed:', error)
      return false
    }
  }

  static async logout(): Promise<LogoutResponse> {
    try {
      const response = await this.deps.http.post<LogoutResponse>('/auth/logout')
      return response
    } finally {
      this.clearToken()
    }
  }
  
  static async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      return await this.deps.http.post<AuthResponse>('/auth/register', credentials)
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('409')) {
          throw new Error('Email already exists')
        }
        if (error.message.includes('400')) {
          throw new Error('Invalid registration data')
        }
      }
      throw error
    }
  }

  static async refreshToken(): Promise<RefreshResponse> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    const currentToken = this.getToken()
    if (!currentToken) {
      throw new Error('No token')
    }

    this.refreshPromise = this.performRefresh(currentToken)
    
    try {
      const result = await this.refreshPromise
      return result
    } finally {
      this.refreshPromise = null
    }
  }

  private static async performRefresh(currentToken: string): Promise<RefreshResponse> {
    return this.deps.http.post<RefreshResponse>('/auth/refresh')
  }

  static async completeOnboarding(): Promise<{ message: string; onboarding_completed: boolean }> {
    return this.deps.http.put<{ message: string; onboarding_completed: boolean }>('/auth/onboarding/complete')
  }
}
