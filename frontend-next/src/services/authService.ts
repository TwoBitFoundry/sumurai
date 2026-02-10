import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { IStorageAdapter } from './boundaries';
import { BrowserStorageAdapter } from './boundaries';
import { ApiClient, AuthenticationError } from './ApiClient';

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
    this.deps = deps;
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
    this.deps.storage.setItem('auth_token', token);
    if (refreshToken) {
      this.deps.storage.setItem('refresh_token', refreshToken);
    }
    this.scheduleEncryptedTokenHash(token);
  }

  static getToken(): string | null {
    return this.deps.storage.getItem('auth_token');
  }

  static clearToken(): void {
    this.deps.storage.removeItem('auth_token');
    this.deps.storage.removeItem('refresh_token');
    localStorage.removeItem('plaid_user_id');
    this.refreshPromise = null;
    this.encryptedTokenHash = null;
    this.encryptedTokenHashPromise = null;
    this.hashedTokenSource = null;
  }

  static getEncryptedTokenHashSync(): string | null {
    if (this.encryptedTokenHash) {
      return this.encryptedTokenHash;
    }
    const token = this.getToken();
    if (!token) {
      return null;
    }
    if (!this.encryptedTokenHashPromise || this.hashedTokenSource !== token) {
      this.scheduleEncryptedTokenHash(token);
    }
    return this.encryptedTokenHash;
  }

  static async ensureEncryptedTokenHash(): Promise<string | null> {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    if (this.encryptedTokenHash && this.hashedTokenSource === token) {
      return this.encryptedTokenHash;
    }

    if (!this.encryptedTokenHashPromise || this.hashedTokenSource !== token) {
      this.scheduleEncryptedTokenHash(token);
    }

    try {
      return await this.encryptedTokenHashPromise;
    } catch {
      return null;
    }
  }

  static async validateSession(): Promise<boolean> {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    try {
      await ApiClient.get('/providers/status');
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        this.clearToken();
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
      this.clearToken();
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
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.getToken()) {
      throw new Error('No token');
    }

    this.refreshPromise = this.performRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private static async performRefresh(): Promise<RefreshResponse> {
    const tracer = trace.getTracer('auth-service');
    const span = tracer.startSpan('AuthService.refreshToken');

    try {
      const response = await ApiClient.post<RefreshResponse>('/auth/refresh');
      span.setStatus({ code: SpanStatusCode.OK });
      this.scheduleEncryptedTokenHash(response.token);
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

    if (this.hashedTokenSource === token && this.encryptedTokenHash) {
      return;
    }

    this.hashedTokenSource = token;
    this.encryptedTokenHashPromise = this.computeEncryptedTokenHash(token)
      .then((hash) => {
        this.encryptedTokenHash = hash;
        return hash;
      })
      .catch((error) => {
        console.warn('Failed to compute encrypted token hash:', error);
        this.encryptedTokenHash = null;
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
