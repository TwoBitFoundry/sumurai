import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ApiClient, AuthenticationError } from './ApiClient';
import type { IStorageAdapter } from './boundaries';
import { BrowserStorageAdapter } from './boundaries';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user_id: string;
  expires_at: string;
  onboarding_completed: boolean;
}

interface RefreshResponse {
  token: string;
  user_id: string;
  expires_at: string;
  onboarding_completed: boolean;
}

interface LogoutResponse {
  message: string;
  cleared_session: string;
}

interface AuthServiceDependencies {
  storage: IStorageAdapter;
}

export class AuthService {
  private static refreshPromise: Promise<RefreshResponse> | null = null;
  private static deps: AuthServiceDependencies = {
    storage: new BrowserStorageAdapter(),
  };
  private static encryptedTokenHash: string | null = null;
  private static encryptedTokenHashPromise: Promise<string | null> | null = null;
  private static hashedTokenSource: string | null = null;

  static configure(deps: AuthServiceDependencies): void {
    AuthService.deps = deps;
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

  static storeToken(token: string, refreshToken?: string): void {
    AuthService.deps.storage.setItem('auth_token', token);
    if (refreshToken) {
      AuthService.deps.storage.setItem('refresh_token', refreshToken);
    }
    AuthService.scheduleEncryptedTokenHash(token);
  }

  static getToken(): string | null {
    return AuthService.deps.storage.getItem('auth_token');
  }

  static clearToken(): void {
    AuthService.deps.storage.removeItem('auth_token');
    AuthService.deps.storage.removeItem('refresh_token');
    localStorage.removeItem('plaid_user_id');
    AuthService.refreshPromise = null;
    AuthService.encryptedTokenHash = null;
    AuthService.encryptedTokenHashPromise = null;
    AuthService.hashedTokenSource = null;
  }

  static getEncryptedTokenHashSync(): string | null {
    if (AuthService.encryptedTokenHash) {
      return AuthService.encryptedTokenHash;
    }
    const token = AuthService.getToken();
    if (!token) {
      return null;
    }
    if (!AuthService.encryptedTokenHashPromise || AuthService.hashedTokenSource !== token) {
      AuthService.scheduleEncryptedTokenHash(token);
    }
    return AuthService.encryptedTokenHash;
  }

  static async ensureEncryptedTokenHash(): Promise<string | null> {
    const token = AuthService.getToken();
    if (!token) {
      return null;
    }

    if (AuthService.encryptedTokenHash && AuthService.hashedTokenSource === token) {
      return AuthService.encryptedTokenHash;
    }

    if (!AuthService.encryptedTokenHashPromise || AuthService.hashedTokenSource !== token) {
      AuthService.scheduleEncryptedTokenHash(token);
    }

    try {
      return await AuthService.encryptedTokenHashPromise;
    } catch {
      return null;
    }
  }

  static async validateSession(): Promise<boolean> {
    const token = AuthService.getToken();
    if (!token) {
      return false;
    }

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

    if (!AuthService.getToken()) {
      throw new Error('No token');
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
      AuthService.scheduleEncryptedTokenHash(response.token);
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

  private static scheduleEncryptedTokenHash(token: string): void {
    if (!token) {
      return;
    }

    if (AuthService.hashedTokenSource === token && AuthService.encryptedTokenHash) {
      return;
    }

    AuthService.hashedTokenSource = token;
    AuthService.encryptedTokenHashPromise = AuthService.computeEncryptedTokenHash(token)
      .then((hash) => {
        AuthService.encryptedTokenHash = hash;
        return hash;
      })
      .catch((error) => {
        console.warn('Failed to compute encrypted token hash:', error);
        AuthService.encryptedTokenHash = null;
        return null;
      });
  }

  private static async computeEncryptedTokenHash(token: string): Promise<string | null> {
    try {
      if (process.env.NODE_ENV === 'test') {
        return null;
      }
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        console.warn('Web Crypto API is not available; cannot compute encrypted token hash.');
        return null;
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const digest = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(digest));
      return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Error computing encrypted token hash:', error);
      return null;
    }
  }
}
