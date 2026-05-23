import { jest } from '@jest/globals';
import { ApiClient } from '@/services/ApiClient';
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

  describe('submitSetupToken', () => {
    it('posts to providers connect with simplefin payload', async () => {
      postSpy.mockResolvedValue({
        connection_id: 'conn-1',
        institution_name: 'SimpleFIN (2 institutions)',
      } as any);

      const result = await SimpleFinService.submitSetupToken('abc');

      expect(ApiClient.post).toHaveBeenCalledWith('/providers/connect', {
        provider: 'simplefin',
        access_token: 'abc',
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
