import { ApiClient } from '@/services/ApiClient';
import { AuthService } from '@/services/authService';
import type { IHttpClient } from '@/services/boundaries/IHttpClient';
import type { IStorageAdapter } from '@/services/boundaries/IStorageAdapter';

class MockHttpClient implements IHttpClient {
  get = jest.fn();
  post = jest.fn();
  put = jest.fn();
  delete = jest.fn();
  healthCheck = jest.fn();
}

class MockStorageAdapter implements IStorageAdapter {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('AuthService with Injected Boundaries', () => {
  let mockHttpClient: MockHttpClient;
  let mockStorageAdapter: MockStorageAdapter;

  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    mockStorageAdapter = new MockStorageAdapter();
    ApiClient.configure(mockHttpClient);
    AuthService.configure({
      storage: mockStorageAdapter,
    });
    mockStorageAdapter.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should use injected http client for login request', async () => {
      const loginResponse = {
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: false,
      };
      mockHttpClient.post.mockResolvedValueOnce(loginResponse);

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/auth/login',
        {
          email: 'test@example.com',
          password: 'password123',
        },
        expect.any(Object)
      );
      expect(result).toEqual(loginResponse);
    });

    it('should not write auth tokens to injected storage', async () => {
      const loginResponse = {
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: false,
      };
      mockHttpClient.post.mockResolvedValueOnce(loginResponse);

      await AuthService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockStorageAdapter.getItem('auth_token')).toBeNull();
    });
  });

  describe('token storage', () => {
    it('should ignore stored auth tokens in injected storage', () => {
      mockStorageAdapter.setItem('auth_token', 'test-token-123');
      expect(AuthService.getToken()).toBeNull();
    });

    it('should not store refresh token data', () => {
      AuthService.storeToken('access-token', 'refresh-token');
      expect(AuthService.getToken()).toBeNull();
      expect(mockStorageAdapter.getItem('refresh_token')).toBeNull();
    });

    it('should clear auth session state without touching injected storage', () => {
      mockStorageAdapter.setItem('auth_token', 'test-token');

      AuthService.clearToken();
      expect(AuthService.getToken()).toBeNull();
      expect(mockStorageAdapter.getItem('auth_token')).toBe('test-token');
    });
  });

  describe('register', () => {
    it('should use injected http client for register request', async () => {
      const registerResponse = {
        user_id: 'user-456',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: false,
      };
      mockHttpClient.post.mockResolvedValueOnce(registerResponse);

      const result = await AuthService.register({
        email: 'newuser@example.com',
        password: 'password123',
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/auth/register',
        {
          email: 'newuser@example.com',
          password: 'password123',
        },
        expect.any(Object)
      );
      expect(result).toEqual(registerResponse);
    });
  });

    describe('validateSession', () => {
      it('should use injected http client to validate session', async () => {
      mockHttpClient.get.mockResolvedValueOnce({
        connections: [],
      });

      const result = await AuthService.validateSession();

      expect(result).toBe(true);
    });

    it('should return false when validation endpoint rejects', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('401 Unauthorized'));

      const result = await AuthService.validateSession();

      expect(result).toBe(false);
    });
  });

  describe('logout', () => {
    it('should use injected http client for logout request', async () => {
      mockHttpClient.post.mockResolvedValueOnce({
        message: 'Logged out',
        cleared_session: 'session-123',
      });

      const result = await AuthService.logout();

      expect(mockHttpClient.post).toHaveBeenCalled();
      expect(result.message).toBe('Logged out');
    });

    it('should clear token after logout', async () => {
      mockHttpClient.post.mockResolvedValueOnce({
        message: 'Logged out',
        cleared_session: 'session-123',
      });

      await AuthService.logout();

      expect(AuthService.getToken()).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should use injected http client to refresh token', async () => {
      const refreshResponse = {
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: true,
      };
      mockHttpClient.post.mockResolvedValueOnce(refreshResponse);

      const result = await AuthService.refreshToken();

      expect(mockHttpClient.post).toHaveBeenCalled();
      expect(result).toEqual(refreshResponse);
    });

    it('should prevent multiple simultaneous refresh attempts', async () => {
      const refreshResponse = {
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: true,
      };
      mockHttpClient.post.mockResolvedValueOnce(refreshResponse);

      const promise1 = AuthService.refreshToken();
      const promise2 = AuthService.refreshToken();

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1).toEqual(result2);
      expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('completeOnboarding', () => {
    it('should use injected http client to complete onboarding', async () => {
      mockHttpClient.put.mockResolvedValueOnce({
        message: 'Onboarding completed',
        onboarding_completed: true,
      });

      const result = await AuthService.completeOnboarding();

      expect(mockHttpClient.put).toHaveBeenCalled();
      expect(result.onboarding_completed).toBe(true);
    });
  });
});
