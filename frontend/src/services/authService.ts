import { SpanStatusCode, trace } from '@opentelemetry/api';
import type {
  AuthResponse,
  LogoutResponse,
  PasswordLoginRequest,
  RefreshResponse,
} from '@/types/api';
import { ApiClient } from './ApiClient';
import type { IStorageAdapter } from './boundaries';

export type { AuthResponse, LogoutResponse, RefreshResponse } from '@/types/api';

interface AuthServiceDependencies {
  storage: IStorageAdapter;
}

export class AuthService {
  private static refreshPromise: Promise<RefreshResponse> | null = null;

  static configure(_deps: AuthServiceDependencies): void {}

  static storeToken(..._args: unknown[]): void {}

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

  static async refreshToken(): Promise<RefreshResponse> {
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

  static async loginWithPassword(email: string, password: string): Promise<AuthResponse> {
    const body: PasswordLoginRequest = { email, password };
    return ApiClient.post<AuthResponse>('/auth/login/password', body);
  }
}
