import { jest } from 'bun:test';
import { ApiClient, ApiError, RateLimitError } from '@/services/ApiClient';
import { SimpleFinService } from '@/services/SimpleFinService';
import type { PlaidDisconnectResponse, ProviderStatusResponse } from '@/types/api';

describe('SimpleFinService', () => {
  let postSpy: jest.SpiedFunction<typeof ApiClient.post>;
  let getSpy: jest.SpiedFunction<typeof ApiClient.get>;
  let toLocaleDateStringSpy: jest.SpiedFunction<typeof Date.prototype.toLocaleDateString>;
  let dateTimeFormatSpy: jest.SpiedFunction<typeof Intl.DateTimeFormat>;

  beforeEach(() => {
    jest.clearAllMocks();
    postSpy = jest.spyOn(ApiClient, 'post');
    getSpy = jest.spyOn(ApiClient, 'get');
    postSpy.mockResolvedValue({ transactions: [] } as any);
    toLocaleDateStringSpy = jest
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('2025-06-15');
    dateTimeFormatSpy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'America/Chicago' }),
    } as any);
  });

  afterEach(() => {
    postSpy.mockRestore();
    getSpy.mockRestore();
    toLocaleDateStringSpy.mockRestore();
    dateTimeFormatSpy.mockRestore();
  });

  describe('connect', () => {
    it('posts to providers connect with simplefin payload', async () => {
      postSpy.mockResolvedValue({
        connection_id: 'conn-1',
        institution_name: 'SimpleFIN (2 institutions)',
      } as any);

      const result = await SimpleFinService.connect('setup-token');

      expect(ApiClient.post).toHaveBeenCalledWith('/providers/connect', {
        provider: 'simplefin',
        access_token: '',
        enrollment_id: '',
        simplefin: {
          simplefin_setup_token: 'setup-token',
        },
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
          transactions: Array.from({ length: 12 }, (_, index) => ({ id: `txn-${index}` })),
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
        provider: 'simplefin',
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

      expect(result).toEqual({
        rateLimited: false,
        transactionCount: 12,
        institutionsRequiringAuth: [],
      });
      expect(postSpy).toHaveBeenCalledWith('/providers/sync-transactions', {
        connection_id: 'conn-from-status',
        client_date: '2025-06-15',
        client_timezone: 'America/Chicago',
      });
      expect(postSpy).toHaveBeenCalledTimes(2);
    });

    it('skips sync when connect succeeds but no institutions are linked yet', async () => {
      postSpy.mockResolvedValueOnce({
        connection_id: 'conn-from-connect',
        institution_name: 'SimpleFIN (0 institutions)',
      } as any);
      getSpy.mockResolvedValue({
        provider: 'simplefin',
        connections: [],
      } as any);

      const result = await SimpleFinService.connectAndSyncAll();

      expect(result).toEqual({
        rateLimited: false,
        transactionCount: 0,
        institutionsRequiringAuth: [],
      });
      expect(postSpy).toHaveBeenCalledTimes(1);
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
        connections: [
          {
            is_connected: true,
            last_sync_at: null,
            institution_name: 'Bank A',
            connection_id: 'conn-from-status',
            item_id: 'simplefin_org_a',
            transaction_count: 0,
            account_count: 1,
            sync_in_progress: false,
          },
        ],
      } as any);

      const result = await SimpleFinService.connectAndSyncAll();

      expect(result).toEqual({
        rateLimited: true,
        transactionCount: 0,
        institutionsRequiringAuth: [],
      });
    });

    it('returns auth notices from connect response', async () => {
      postSpy.mockResolvedValueOnce({
        connection_id: 'conn-from-connect',
        institution_name: 'SimpleFIN (2 institutions)',
        simplefin_institutions_requiring_auth: [
          {
            institution_name: 'Bank of Oklahoma',
            org_conn_id: 'bok',
            message: 'Connection to Bank of Oklahoma may need attention. Auth required',
          },
        ],
      } as any);
      getSpy.mockResolvedValue({
        provider: 'simplefin',
        connections: [
          {
            is_connected: true,
            last_sync_at: null,
            institution_name: 'Bank A',
            connection_id: 'conn-from-status',
            item_id: 'simplefin_org_a',
            transaction_count: 0,
            account_count: 1,
            sync_in_progress: false,
          },
        ],
      } as any);

      const result = await SimpleFinService.connectAndSyncAll();

      expect(result.institutionsRequiringAuth).toEqual([
        {
          institution_name: 'Bank of Oklahoma',
          org_conn_id: 'bok',
          message: 'Connection to Bank of Oklahoma may need attention. Auth required',
        },
      ]);
      expect(postSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('restoreInstitution', () => {
    it('unhides org, connects, and syncs the matching connection', async () => {
      postSpy
        .mockResolvedValueOnce({ restored: true } as any)
        .mockResolvedValueOnce({
          connection_id: 'conn-demo',
          institution_name: 'SimpleFIN Demo',
        } as any)
        .mockResolvedValue({
          transactions: Array.from({ length: 7 }, (_, index) => ({ id: `txn-${index}` })),
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

      expect(result).toEqual({
        rateLimited: false,
        transactionCount: 7,
        institutionsRequiringAuth: [],
      });
      expect(postSpy).toHaveBeenCalledWith('/providers/simplefin/ignored-institutions', {
        org_conn_id: 'demo-org',
      });
      expect(postSpy).toHaveBeenCalledWith('/providers/sync-transactions', {
        connection_id: 'conn-demo',
        client_date: '2025-06-15',
        client_timezone: 'America/Chicago',
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
        client_timezone: 'America/Chicago',
      });
    });
  });

  describe('syncBridge', () => {
    it('returns structured bridge results from a single sync request', async () => {
      postSpy.mockResolvedValue({
        transactions: [],
        metadata: {
          transaction_count: 4,
          account_count: 2,
          sync_timestamp: '2025-06-15T10:00:00Z',
          start_date: '2025-06-01',
          end_date: '2025-06-15',
          connection_updated: true,
        },
        simplefin_institution_results: [
          {
            institution_name: 'Bank A',
            org_conn_id: 'org-a',
            status: 'synced',
            transaction_count: 4,
          },
        ],
        bridge_warnings: ['Bridge warning'],
      } as any);

      const result = await SimpleFinService.syncBridge('conn-123');

      expect(ApiClient.post).toHaveBeenCalledWith('/providers/sync-transactions', {
        connection_id: 'conn-123',
        client_date: '2025-06-15',
        client_timezone: 'America/Chicago',
      });
      expect(result).toEqual({
        rateLimited: false,
        transactions: [],
        metadata: {
          transaction_count: 4,
          account_count: 2,
          sync_timestamp: '2025-06-15T10:00:00Z',
          start_date: '2025-06-01',
          end_date: '2025-06-15',
          connection_updated: true,
        },
        simplefin_institution_results: [
          {
            institution_name: 'Bank A',
            org_conn_id: 'org-a',
            status: 'synced',
            transaction_count: 4,
          },
        ],
        bridge_warnings: ['Bridge warning'],
      });
    });

    it('returns structured rate limit results when the bridge is throttled', async () => {
      postSpy.mockRejectedValue(new RateLimitError('Too many requests', 7200));

      const result = await SimpleFinService.syncBridge('conn-123');

      expect(result).toEqual({
        rateLimited: true,
        retryAfterSeconds: 7200,
        transactions: [],
        simplefin_institution_results: [],
        bridge_warnings: [],
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
