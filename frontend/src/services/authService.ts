import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ApiClient, AuthenticationError } from './ApiClient';
import type { IStorageAdapter } from './boundaries';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user_id: string;
  expires_at: string;
  onboarding_completed: boolean;
}

export interface RefreshResponse {
  user_id: string;
  expires_at: string;
  onboarding_completed: boolean;
}

export interface LogoutResponse {
  message: string;
  cleared_session: string;
}

interface AuthServiceDependencies {
  storage: IStorageAdapter;
}

export class AuthService {
  private static refreshPromise: Promise<RefreshResponse> | null = null;

  static configure(_deps: AuthServiceDependencies): void {
  }

  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const tracer = trace.getTracer('auth-service');
    const span = tracer.startSpan('AuthService.login', {
      attributes: {
        'auth.method': 'password',
        'auth.username': credentials.email,
      },
    });

    try {
      const response = await ApiClient.post<AuthResponse>('/auth/login', credentials);
      span.setStatus({ code: SpanStatusCode.OK });
      return response;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });

      if (error instanceof AuthenticationError) {
        throw new Error('Invalid email or password');
      }
      if (error instanceof Error) {
        if (error.message.includes('500')) {
          throw new Error('Server error. Please try again later.');
        }
      }
      throw error;
    } finally {
      span.end();
    }
  }

  static storeToken(..._args: unknown[]): void {
  }

  static getToken(): string | null {
    return null;
  }

  static clearToken(): void {
    localStorage.removeItem('plaid_user_id');
    AuthService.refreshPromise = null;
  }

  static getEncryptedTokenHashSync(): string | null {
    return null;
  }

  static async ensureEncryptedTokenHash(): Promise<string | null> {
    return null;
  }

  static async validateSession(): Promise<boolean> {
    try {
      await ApiClient.get('/providers/status');
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        AuthService.clearToken();
        return false;
      }
      console.warn('Session validation failed:', error);
      return false;
    }
  }

  static async logout(): Promise<LogoutResponse> {
    const tracer = trace.getTracer('auth-service');
    const span = tracer.startSpan('AuthService.logout');

    try {
      const response = await ApiClient.post<LogoutResponse>('/auth/logout');
      span.setStatus({ code: SpanStatusCode.OK });
      return response;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
      AuthService.clearToken();
    }
  }

  static async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const tracer = trace.getTracer('auth-service');
    const span = tracer.startSpan('AuthService.register', {
      attributes: {
        'auth.method': 'password',
        'auth.username': credentials.email,
      },
    });

    try {
      const response = await ApiClient.post<AuthResponse>('/auth/register', credentials);
      span.setStatus({ code: SpanStatusCode.OK });
      return response;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });

      if (error instanceof Error) {
        if (error.message.includes('409')) {
          throw new Error('Email already exists');
        }
        if (error.message.includes('400')) {
          throw new Error('Invalid registration data');
        }
      }
      throw error;
    } finally {
      span.end();
    }
  }

  static async refreshToken(): Promise<RefreshResponse> {
    // Prevent multiple simultaneous refresh attempts
    if (AuthService.refreshPromise) {
      return AuthService.refreshPromise;
    }

    AuthService.refreshPromise = AuthService.performRefresh();

    try {
      const result = await AuthService.refreshPromise;
      return result;
    } finally {
      AuthService.refreshPromise = null;
    }
  }

  private static async performRefresh(): Promise<RefreshResponse> {
    const tracer = trace.getTracer('auth-service');
    const span = tracer.startSpan('AuthService.refreshToken');

    try {
      const response = await ApiClient.post<RefreshResponse>('/auth/refresh');
      span.setStatus({ code: SpanStatusCode.OK });
      return response;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  static async completeOnboarding(): Promise<{ message: string; onboarding_completed: boolean }> {
    return ApiClient.put<{ message: string; onboarding_completed: boolean }>(
      '/auth/onboarding/complete'
    );
  }

}
