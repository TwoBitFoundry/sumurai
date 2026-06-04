import { expect } from 'bun:test';
import {
  ApiClient,
  ApiError,
  AuthenticationError,
  ConflictError,
  DEFAULT_API_BASE,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  ServerError,
  ValidationError,
} from '@/services/ApiClient';
import { AuthService } from '@/services/authService';
import { setupTestBoundaries } from '../setup/setupTestBoundaries';

expect.extend({
  toHaveBeenCalledOnce(received: jest.Mock | jest.Spied<any>) {
    const calls = (received as jest.Mock).mock?.calls?.length ?? 0;
    const pass = calls === 1;
    return {
      pass,
      message: () => `expected mock to have been called once, but was called ${calls} times`,
    };
  },
});

describe('ApiClient with Injected IHttpClient', () => {
  let mockHttp: any;
  let setTimeoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout').mockImplementation(((
      handler: TimerHandler
    ) => {
      if (typeof handler === 'function') {
        handler();
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);
    const boundaries = setupTestBoundaries();
    mockHttp = boundaries.http;
    jest.spyOn(AuthService, 'clearToken');
    ApiClient.setTestMaxRetries(0);
  });

  it('defaults to same-origin api routing when no override is provided', () => {
    expect(DEFAULT_API_BASE).toBe('/api');
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  describe('Basic HTTP Methods', () => {
    it('should make GET requests successfully', async () => {
      mockHttp.get.mockResolvedValueOnce({ data: 'success' });

      const result = await ApiClient.get('/test');

      expect(result).toEqual({ data: 'success' });
      expect(mockHttp.get).toHaveBeenCalledWith('/test', expect.any(Object));
    });

    it('should make POST requests successfully', async () => {
      mockHttp.post.mockResolvedValueOnce({ created: true });

      const result = await ApiClient.post('/test', { data: 'test' });

      expect(result).toEqual({ created: true });
      expect(mockHttp.post).toHaveBeenCalledWith('/test', { data: 'test' }, expect.any(Object));
    });

    it('should make multipart POST requests successfully', async () => {
      mockHttp.postFormData.mockResolvedValueOnce({ imported: true });
      const formData = new FormData();
      formData.append('account_id', 'account-123');

      const result = await ApiClient.postFormData('/transactions/import', formData);

      expect(result).toEqual({ imported: true });
      expect(mockHttp.postFormData).toHaveBeenCalledWith(
        '/transactions/import',
        formData,
        expect.any(Object)
      );
    });

    it('should make PUT requests successfully', async () => {
      mockHttp.put.mockResolvedValueOnce({ updated: true });

      const result = await ApiClient.put('/test', { data: 'updated' });

      expect(result).toEqual({ updated: true });
      expect(mockHttp.put).toHaveBeenCalledWith('/test', { data: 'updated' }, expect.any(Object));
    });

    it('should make DELETE requests successfully', async () => {
      mockHttp.delete.mockResolvedValueOnce({});

      const result = await ApiClient.delete('/test');

      expect(result).toEqual({});
      expect(mockHttp.delete).toHaveBeenCalledWith('/test', expect.any(Object));
    });

    it('should make GET blob requests successfully', async () => {
      const blob = new Blob(['exported'], { type: 'text/csv' });
      mockHttp.getBlob.mockResolvedValueOnce({ blob, filename: 'sumurai-export-20240601.csv' });

      const result = await ApiClient.getBlob('/export?format=csv');

      expect(result).toEqual({ blob, filename: 'sumurai-export-20240601.csv' });
      expect(mockHttp.getBlob).toHaveBeenCalledWith('/export?format=csv', expect.any(Object));
    });
  });

  describe('Authentication Integration', () => {
    it('should handle 401 responses with token refresh', async () => {
      jest.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: true,
      });

      mockHttp.get
        .mockRejectedValueOnce(new AuthenticationError())
        .mockResolvedValueOnce({ data: 'success' });

      const result = await ApiClient.get('/test');

      expect(result).toEqual({ data: 'success' });
      expect(AuthService.refreshToken).toHaveBeenCalledOnce();
    });

    it('should clear token when refresh fails', async () => {
      jest.spyOn(AuthService, 'refreshToken').mockRejectedValueOnce(new Error('Refresh failed'));

      mockHttp.get.mockRejectedValueOnce(new AuthenticationError());

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError);
      expect(AuthService.clearToken).toHaveBeenCalledOnce();
    });

    it('should not refresh token when passkey login finish returns 401', async () => {
      const refreshSpy = jest.spyOn(AuthService, 'refreshToken');
      mockHttp.post.mockRejectedValueOnce(new AuthenticationError());

      await expect(
        ApiClient.post('/auth/passkey/login/finish', {
          session_id: 'session-1',
          response: {},
        })
      ).rejects.toThrow(AuthenticationError);

      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('should clear token when retry after refresh receives another 401', async () => {
      jest.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: true,
      });

      mockHttp.get
        .mockRejectedValueOnce(new AuthenticationError())
        .mockRejectedValueOnce(new AuthenticationError());

      await expect(ApiClient.get('/test')).rejects.toThrow(AuthenticationError);
      expect(AuthService.clearToken).toHaveBeenCalledOnce();
    });

    it('should refresh token for blob requests after a 401 response', async () => {
      jest.spyOn(AuthService, 'refreshToken').mockResolvedValueOnce({
        user_id: 'user-123',
        expires_at: '2025-12-31T00:00:00Z',
        onboarding_completed: true,
      });

      const blob = new Blob(['exported'], { type: 'text/csv' });
      mockHttp.getBlob
        .mockRejectedValueOnce(new AuthenticationError())
        .mockResolvedValueOnce({ blob, filename: 'sumurai-export-20240601.csv' });

      const result = await ApiClient.getBlob('/export?format=csv');

      expect(result).toEqual({ blob, filename: 'sumurai-export-20240601.csv' });
      expect(AuthService.refreshToken).toHaveBeenCalledOnce();
    });
  });

  describe('Error Handling', () => {
    it('should throw ApiError for server errors', async () => {
      const error = new ServerError(500, 'Server error');
      mockHttp.get.mockRejectedValueOnce(error);

      try {
        await ApiClient.get('/test');
        throw new Error('Expected error to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ServerError);
        expect((err as ApiError).status).toBe(500);
      }
    });

    it('should throw ApiError for client errors', async () => {
      const error = new ValidationError('Bad request');
      mockHttp.get.mockRejectedValueOnce(error);

      try {
        await ApiClient.get('/test');
        throw new Error('Expected error to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ApiError).status).toBe(400);
      }
    });
  });

  describe('Health Check', () => {
    it('should call health check endpoint', async () => {
      mockHttp.get.mockResolvedValueOnce('OK');

      const result = await ApiClient.healthCheck();

      expect(result).toBe('OK');
      expect(mockHttp.get).toHaveBeenCalledWith('/health', expect.any(Object));
    });

    it('should throw ApiError for health check failures', async () => {
      mockHttp.get.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(ApiClient.healthCheck()).rejects.toThrow(ApiError);
    });
  });

  describe('Error Type Handling', () => {
    it('should throw ConflictError for 409 status', async () => {
      const error = new ConflictError('Email already exists');
      mockHttp.post.mockRejectedValueOnce(error);

      try {
        await ApiClient.post('/register', { email: 'test@example.com' });
        throw new Error('Expected error to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect((err as ConflictError).status).toBe(409);
      }
    });

    it('should throw NotFoundError for 404 status', async () => {
      const error = new NotFoundError('Resource not found');
      mockHttp.get.mockRejectedValueOnce(error);

      try {
        await ApiClient.get('/nonexistent');
        throw new Error('Expected error to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
        expect((err as NotFoundError).status).toBe(404);
      }
    });

    it('should throw ForbiddenError for 403 status', async () => {
      const error = new ForbiddenError('Access forbidden');
      mockHttp.get.mockRejectedValueOnce(error);

      try {
        await ApiClient.get('/admin');
        throw new Error('Expected error to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError);
        expect((err as ForbiddenError).status).toBe(403);
      }
    });

    it('dispatches enrollment-required event when passkey enrollment is needed', async () => {
      const dispatched: Event[] = [];
      const handler = (event: Event) => dispatched.push(event);
      window.addEventListener('sumurai:enrollment-required', handler);

      mockHttp.get.mockRejectedValueOnce(
        new ForbiddenError(
          'Passkey enrollment is required before continuing',
          'passkey_enrollment_required'
        )
      );

      await expect(ApiClient.get('/budgets')).rejects.toBeInstanceOf(ForbiddenError);
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0].type).toBe('sumurai:enrollment-required');

      window.removeEventListener('sumurai:enrollment-required', handler);
    });

    it('should throw NetworkError for network failures', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'));

      try {
        await ApiClient.get('/test');
        throw new Error('Expected error to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
      }
    });
  });

  describe('Retry Logic Integration', () => {
    beforeEach(() => {
      ApiClient.setTestMaxRetries(2);
    });

    it('should retry on retryable errors', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new ServerError(503, 'Service Unavailable'))
        .mockResolvedValueOnce({ data: 'success' });

      const result = await ApiClient.get('/test');

      expect(result).toEqual({ data: 'success' });
      expect(mockHttp.get).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable client errors', async () => {
      mockHttp.get.mockRejectedValueOnce(new ApiError(400, 'Invalid request'));

      await expect(ApiClient.get('/test')).rejects.toThrow(ApiError);
      expect(mockHttp.get).toHaveBeenCalledOnce();
    });

    it('should not retry rate-limited responses', async () => {
      mockHttp.post.mockRejectedValueOnce(new ApiError(429, 'Sync is rate-limited'));

      await expect(ApiClient.post('/providers/sync-transactions', {})).rejects.toThrow(ApiError);
      expect(mockHttp.post).toHaveBeenCalledOnce();
    });

    it('should retry POST requests on transient errors', async () => {
      mockHttp.post
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce({ success: true });

      const result = await ApiClient.post('/test', { data: 'test' });

      expect(result).toEqual({ success: true });
      expect(mockHttp.post).toHaveBeenCalledTimes(2);
    });

    it('should retry multipart POST requests on transient errors', async () => {
      const formData = new FormData();
      mockHttp.postFormData
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce({ success: true });

      const result = await ApiClient.postFormData('/transactions/import', formData);

      expect(result).toEqual({ success: true });
      expect(mockHttp.postFormData).toHaveBeenCalledTimes(2);
    });

    it('should throw NetworkError after exhausting retries', async () => {
      mockHttp.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(ApiClient.get('/test')).rejects.toThrow(NetworkError);
      expect(mockHttp.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('Request Authorization', () => {
    it('should not inject auth tokens into requests', async () => {
      mockHttp.get.mockResolvedValueOnce({ data: 'success' });

      await ApiClient.get('/protected');

      expect(mockHttp.get).toHaveBeenCalledWith(
        '/protected',
        expect.objectContaining({
          headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
        })
      );
    });

    it('should handle requests without auth token', async () => {
      mockHttp.get.mockResolvedValueOnce({ data: 'success' });

      await ApiClient.get('/public');

      expect(mockHttp.get).toHaveBeenCalledWith('/public', expect.any(Object));
    });
  });
});
