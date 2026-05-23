import { jest } from '@jest/globals';
import { ApiClient, ApiError } from '@/services/ApiClient';
import { SimpleFinService } from '@/services/SimpleFinService';
import type { PlaidDisconnectResponse, ProviderStatusResponse } from '@/types/api';

describe('SimpleFinService', () => {
  let postSpy: jest.SpiedFunction<typeof ApiClient.post>;
  let getSpy: jest.SpiedFunction<typeof ApiClient.get>;
  let toLocaleDateStringSpy: jest.SpiedFunction<typeof Date.prototype.toLocaleDateString>;

  beforeEach(() => {
    jest.clearAllMocks();
    postSpy = jest.spyOn(ApiClient, 'post');
    getSpy = jest.spyOn(ApiClient, 'get');
    toLocaleDateStringSpy = jest
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('2025-06-15');
  });

  afterEach(() => {
    postSpy.mockRestore();
    getSpy.mockRestore();
    toLocaleDateStringSpy.mockRestore();
  });

  describe('connect', () => {
    it('posts to providers connect with simplefin payload', async () => {
      postSpy.mockResolvedValue({
        connection_id: 'conn-1',
        institution_name: 'SimpleFIN (2 institutions)',
      } as any);

      const result = await SimpleFinService.connect();

      expect(ApiClient.post).toHaveBeenCalledWith('/providers/connect', {
        provider: 'simplefin',
        access_token: '',
        enrollment_id: '',
      });
      expect(result).toEqual({
        connection_id: 'conn-1',
        institution_name: 'SimpleFIN (2 institutions)',
      });
    });
  });

  describe('getStatus', () => {
    it('returns simplefin connections from providers status', async () => {
      const mockStatus: ProviderStatusResponse = {
        provider: 'simplefin',
        connections: [
          {
            is_connected: true,
            last_sync_at: '2024-01-15T10:30:00Z',
            institution_name: 'Bank A',
            connection_id: 'conn-123',
            transaction_count: 25,
            account_count: 2,
            sync_in_progress: false,
          },
        ],
      };
      getSpy.mockResolvedValue(mockStatus as any);

      const result = await SimpleFinService.getStatus();

      expect(ApiClient.get).toHaveBeenCalledWith('/providers/status');
      expect(result).toEqual(mockStatus.connections);
    });

    it('returns empty list when status provider is not simplefin', async () => {
      getSpy.mockResolvedValue({
        provider: 'teller',
        connections: [],
      } as any);

      const result = await SimpleFinService.getStatus();

      expect(result).toEqual([]);
    });
  });

  describe('connectAndSyncAll', () => {
    it('connects then syncs one connection without failing on rate limit', async () => {
      postSpy
        .mockResolvedValueOnce({
          connection_id: 'conn-from-connect',
          institution_name: 'Bank A',
        } as any)
        .mockResolvedValue({
          transactions: [],
          metadata: {
            transaction_count: 12,
            account_count: 1,
            sync_timestamp: '',
            start_date: '',
            end_date: '',
            connection_updated: false,
          },
        } as any);
      getSpy.mockResolvedValue({
        provider: 'plaid',
        connections: [
          {
            is_connected: true,
            last_sync_at: null,
            institution_name: 'Bank B',
            connection_id: 'conn-from-status',
            item_id: 'simplefin_org_b',
            transaction_count: 0,
            account_count: 1,
            sync_in_progress: false,
          },
        ],
      } as any);

      const result = await SimpleFinService.connectAndSyncAll();

      expect(result).toEqual({ rateLimited: false, transactionCount: 12 });
      expect(postSpy).toHaveBeenCalledWith('/providers/sync-transactions', {
        connection_id: 'conn-from-connect',
        client_date: '2025-06-15',
      });
      expect(postSpy).toHaveBeenCalledTimes(2);
    });

    it('returns rateLimited when sync responds with 429', async () => {
      postSpy
        .mockResolvedValueOnce({
          connection_id: 'conn-from-connect',
          institution_name: 'Bank A',
        } as any)
        .mockRejectedValueOnce(new ApiError(429, 'Too many requests'));
      getSpy.mockResolvedValue({
        provider: 'simplefin',
        connections: [],
      } as any);

      const result = await SimpleFinService.connectAndSyncAll();

      expect(result).toEqual({ rateLimited: true, transactionCount: 0 });
    });
  });

  describe('restoreInstitution', () => {
    it('unhides org, connects, and syncs the matching connection', async () => {
      postSpy
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({
          connection_id: 'conn-demo',
          institution_name: 'SimpleFIN Demo',
        } as any)
        .mockResolvedValue({
          transactions: [],
          metadata: {
            transaction_count: 7,
            account_count: 2,
            sync_timestamp: '',
            start_date: '',
            end_date: '',
            connection_updated: false,
          },
        } as any);
      getSpy.mockResolvedValue({
        provider: 'simplefin',
        connections: [
          {
            is_connected: true,
            last_sync_at: null,
            institution_name: 'SimpleFIN Demo',
            connection_id: 'conn-demo',
            item_id: 'simplefin_user_demo-org',
            transaction_count: 0,
            account_count: 2,
            sync_in_progress: false,
          },
        ],
      } as any);

      const result = await SimpleFinService.restoreInstitution('demo-org');

      expect(result).toEqual({ rateLimited: false, transactionCount: 7 });
      expect(postSpy).toHaveBeenCalledWith('/providers/simplefin/ignored-institutions', {
        org_conn_id: 'demo-org',
      });
      expect(postSpy).toHaveBeenCalledWith('/providers/sync-transactions', {
        connection_id: 'conn-demo',
        client_date: '2025-06-15',
      });
    });
  });

  describe('syncTransactions', () => {
    it('posts sync request with optional connection id', async () => {
      postSpy.mockResolvedValue({} as any);

      await SimpleFinService.syncTransactions('conn-123');

      expect(ApiClient.post).toHaveBeenCalledWith('/providers/sync-transactions', {
        connection_id: 'conn-123',
        client_date: '2025-06-15',
      });
    });
  });

  describe('disconnect', () => {
    it('posts disconnect with connection id', async () => {
      const mockResponse: PlaidDisconnectResponse = {
        success: true,
        message: 'Successfully disconnected',
        data_cleared: {
          transactions: 1,
          accounts: 1,
          cache_keys: [],
        },
      };
      postSpy.mockResolvedValue(mockResponse as any);

      const result = await SimpleFinService.disconnect('conn-123');

      expect(ApiClient.post).toHaveBeenCalledWith('/providers/disconnect', {
        connection_id: 'conn-123',
      });
      expect(result).toEqual(mockResponse);
    });
  });
});
