import { SpanStatusCode, trace } from '@opentelemetry/api';
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

describe('AuthService logout functionality', () => {
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
    jest.clearAllMocks();
  });

  it('given valid token when logging out then calls logout endpoint and clears tokens', async () => {
    const mockToken = 'valid-jwt-token';
    AuthService.storeToken(mockToken);

    const mockResponse = {
      message: 'Logged out successfully',
      cleared_session: 'session-id',
    };

    mockHttpClient.post.mockResolvedValueOnce(mockResponse);

    const result = await AuthService.logout();

    expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/logout', undefined, expect.any(Object));
    expect(result).toEqual(mockResponse);
    expect(AuthService.getToken()).toBeNull();
  });

  it('given no token when logging out then clears token anyway', async () => {
    const mockResponse = {
      message: 'Logged out',
      cleared_session: '',
    };
    mockHttpClient.post.mockResolvedValueOnce(mockResponse);

    await AuthService.logout();

    expect(AuthService.getToken()).toBeNull();
  });

  it('given server error when logging out then clears tokens locally anyway', async () => {
    const mockToken = 'valid-jwt-token';
    AuthService.storeToken(mockToken);

    mockHttpClient.post.mockRejectedValueOnce(new Error('Server error'));

    await expect(AuthService.logout()).rejects.toThrow('Server error');
    expect(AuthService.getToken()).toBeNull();
  });
});

describe('AuthService with OpenTelemetry Instrumentation', () => {
  let mockSpan: any;
  let mockTracer: any;
  let mockHttpClient: MockHttpClient;
  let mockStorageAdapter: MockStorageAdapter;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpan = {
      recordException: jest.fn(),
      setStatus: jest.fn(),
      end: jest.fn(),
      setAttributes: jest.fn(),
      addEvent: jest.fn(),
    };

    mockTracer = {
      startSpan: jest.fn().mockReturnValue(mockSpan),
    };

    mockHttpClient = new MockHttpClient();
    mockStorageAdapter = new MockStorageAdapter();
    ApiClient.configure(mockHttpClient);
    AuthService.configure({
      storage: mockStorageAdapter,
    });
    jest.spyOn(trace, 'getTracer').mockReturnValue(mockTracer as any);
  });

  it('should create a span for login operation', async () => {
    const credentials = { email: 'test@example.com', password: 'Test1234!' };
    const mockResponse = {
      token: 'test-token',
      user_id: 'user-123',
      expires_at: '2025-12-31',
      onboarding_completed: false,
    };

    mockHttpClient.post.mockResolvedValueOnce(mockResponse);

    await AuthService.login(credentials);

    expect(mockTracer.startSpan).toHaveBeenCalledWith('AuthService.login', {
      attributes: {
        'auth.method': 'password',
        'auth.username': credentials.email,
      },
    });
  });

  it('should set OK status on successful login', async () => {
    const credentials = { email: 'test@example.com', password: 'Test1234!' };
    const mockResponse = {
      token: 'test-token',
      user_id: 'user-123',
      expires_at: '2025-12-31',
      onboarding_completed: false,
    };

    mockHttpClient.post.mockResolvedValueOnce(mockResponse);

    await AuthService.login(credentials);

    expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
  });

  it('should record exception on login failure', async () => {
    const credentials = { email: 'test@example.com', password: 'wrong' };
    const error = new Error('Invalid email or password');

    mockHttpClient.post.mockRejectedValueOnce(error);

    try {
      await AuthService.login(credentials);
    } catch {
      // Expected to throw
    }

    expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
    });
  });

  it('should end span after login completes', async () => {
    const credentials = { email: 'test@example.com', password: 'Test1234!' };
    const mockResponse = {
      token: 'test-token',
      user_id: 'user-123',
      expires_at: '2025-12-31',
      onboarding_completed: false,
    };

    mockHttpClient.post.mockResolvedValueOnce(mockResponse);

    await AuthService.login(credentials);

    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('should create a span for register operation', async () => {
    const credentials = { email: 'newuser@example.com', password: 'Test1234!' };
    const mockResponse = {
      token: 'test-token',
      user_id: 'user-123',
      expires_at: '2025-12-31',
      onboarding_completed: false,
    };

    mockHttpClient.post.mockResolvedValueOnce(mockResponse);

    await AuthService.register(credentials);

    expect(mockTracer.startSpan).toHaveBeenCalledWith('AuthService.register', {
      attributes: {
        'auth.method': 'password',
        'auth.username': credentials.email,
      },
    });
  });

  it('should NOT include password in span attributes', async () => {
    const credentials = { email: 'test@example.com', password: 'Test1234!' };
    const mockResponse = {
      token: 'test-token',
      user_id: 'user-123',
      expires_at: '2025-12-31',
      onboarding_completed: false,
    };

    mockHttpClient.post.mockResolvedValueOnce(mockResponse);

    await AuthService.login(credentials);

    const spanCall = mockTracer.startSpan.mock.calls[0];
    const attributes = spanCall[1]?.attributes || {};
    expect(attributes).not.toHaveProperty('password');
    expect(attributes).not.toHaveProperty('auth.password');
  });
});
