import { jest } from 'bun:test';
import { apiGateway } from '@/features/teller/tellerConnectScript';
import { ApiClient } from '@/services/ApiClient';
import type { IHttpClient } from '@/services/boundaries';
import { TellerService } from '@/services/TellerService';

describe('TellerService and Teller connect gateway', () => {
  let toLocaleDateStringSpy: jest.SpiedFunction<typeof Date.prototype.toLocaleDateString>;
  let dateTimeFormatSpy: jest.SpiedFunction<typeof Intl.DateTimeFormat>;
  let httpClient: IHttpClient;

  beforeEach(() => {
    jest.clearAllMocks();
    toLocaleDateStringSpy = jest
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('2025-06-15');
    dateTimeFormatSpy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'America/Chicago' }),
    } as any);
    httpClient = {
      get: jest.fn(),
      getBlob: jest.fn(),
      post: jest.fn(),
      postFormData: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      healthCheck: jest.fn(),
    };
    ApiClient.configure(httpClient);
  });

  afterEach(() => {
    toLocaleDateStringSpy.mockRestore();
    dateTimeFormatSpy.mockRestore();
  });

  it('returns only teller connections from provider status', async () => {
    const get = httpClient.get as jest.Mock;
    get.mockResolvedValue({
      provider: '',
      connections: [
        {
          provider: 'teller',
          connection_id: 'teller-1',
          institution_name: 'Teller Bank',
          last_sync_at: '2026-06-18T12:00:00Z',
          transaction_count: 3,
          account_count: 2,
          is_connected: true,
          sync_in_progress: false,
        },
        {
          provider: 'plaid',
          connection_id: 'plaid-1',
          institution_name: 'Plaid Bank',
          last_sync_at: null,
          transaction_count: 9,
          account_count: 1,
          is_connected: true,
          sync_in_progress: false,
        },
      ],
    } as any);

    const result = await TellerService.getStatus();

    expect(get).toHaveBeenCalledWith('/providers/status', {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(result).toEqual([
      {
        connection_id: 'teller-1',
        institution_name: 'Teller Bank',
        last_sync_at: '2026-06-18T12:00:00Z',
        transaction_count: 3,
        account_count: 2,
        is_connected: true,
        sync_in_progress: false,
      },
    ]);
  });

  it('includes client_date when syncing from the Teller service', async () => {
    const post = httpClient.post as jest.Mock;
    post.mockResolvedValue({} as any);

    await TellerService.syncTransactions('conn-123');

    expect(post).toHaveBeenCalledWith(
      '/providers/sync-transactions',
      {
        connection_id: 'conn-123',
        client_date: '2025-06-15',
        client_timezone: 'America/Chicago',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  });

  it('includes client_date when syncing from the Teller connect gateway', async () => {
    const post = httpClient.post as jest.Mock;
    post.mockResolvedValue({} as any);

    await apiGateway.syncTransactions('conn-123');

    expect(post).toHaveBeenCalledWith(
      '/providers/sync-transactions',
      {
        connection_id: 'conn-123',
        client_date: '2025-06-15',
        client_timezone: 'America/Chicago',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  });
});
