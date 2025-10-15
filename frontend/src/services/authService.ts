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
  private static deps: AuthServiceDependencies = {
    http: new FetchHttpClient(),
    storage: new BrowserStorageAdapter()
  }

  static configure(deps: Partial<AuthServiceDependencies>): void {
    this.deps = {
      http: deps.http ?? this.deps.http,
      storage: deps.storage ?? this.deps.storage
    }
  }

  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid email or password')
      } else if (response.status === 500) {
        throw new Error('Server error. Please try again later.')
      } else {
        throw new Error('Login failed')
      }
    }

    return response.json()
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
      const response = await fetch('/api/providers/status', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        return true
      }

      if (response.status === 401) {
        this.clearToken()
        return false
      }

      console.warn('Session validation returned unexpected status:', response.status)
      return true
    } catch (error) {
      console.warn('Session validation failed:', error)
      return false
    }
  }

  static async logout(): Promise<LogoutResponse> {
    const token = this.getToken()
    if (!token) {
      throw new Error('No token to logout with')
    }

    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    // Clear token locally regardless of server response
    this.clearToken()

    if (!response.ok) {
      if (response.status === 401) {
        // Token was already invalid, but we cleared it locally
        return { message: 'Logged out locally (token was invalid)', cleared_session: '' }
      } else {
        throw new Error('Logout failed on server, but cleared locally')
      }
    }

    return response.json()
  }
  
  static async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    })

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('Email already exists')
      } else if (response.status === 400) {
        throw new Error('Invalid registration data')
      } else {
        throw new Error('Registration failed')
      }
    }

    return response.json()
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
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
    })
    
    if (!response.ok) {
      this.clearToken()
      if (response.status === 401) {
        throw new Error('Token expired')
      } else {
        throw new Error('Token refresh failed')
      }
    }
    
    return response.json()
  }

  static async completeOnboarding(): Promise<{ message: string; onboarding_completed: boolean }> {
    const token = this.getToken()
    if (!token) {
      throw new Error('No authentication token')
    }

    const response = await fetch('/api/auth/onboarding/complete', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required')
      } else if (response.status === 500) {
        throw new Error('Server error. Please try again later.')
      } else {
        throw new Error('Failed to complete onboarding')
      }
    }

    return response.json()
  }
}
