import { jest } from 'bun:test';
import { apiGateway } from '@/features/teller/tellerConnectScript';
import { ApiClient } from '@/services/ApiClient';
import { TellerService } from '@/services/TellerService';

describe('TellerService and Teller connect gateway', () => {
  let postSpy: jest.SpiedFunction<typeof ApiClient.post>;
  let toLocaleDateStringSpy: jest.SpiedFunction<typeof Date.prototype.toLocaleDateString>;
  let dateTimeFormatSpy: jest.SpiedFunction<typeof Intl.DateTimeFormat>;

  beforeEach(() => {
    jest.clearAllMocks();
    postSpy = jest.spyOn(ApiClient, 'post');
    toLocaleDateStringSpy = jest
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('2025-06-15');
    dateTimeFormatSpy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'America/Chicago' }),
    } as any);
  });

  afterEach(() => {
    postSpy.mockRestore();
    toLocaleDateStringSpy.mockRestore();
    dateTimeFormatSpy.mockRestore();
  });

  it('includes client_date when syncing from the Teller service', async () => {
    postSpy.mockResolvedValue({} as any);

    await TellerService.syncTransactions('conn-123');

    expect(ApiClient.post).toHaveBeenCalledWith('/providers/sync-transactions', {
      connection_id: 'conn-123',
      client_date: '2025-06-15',
      client_timezone: 'America/Chicago',
    });
  });

  it('includes client_date when syncing from the Teller connect gateway', async () => {
    postSpy.mockResolvedValue({} as any);

    await apiGateway.syncTransactions('conn-123');

    expect(ApiClient.post).toHaveBeenCalledWith('/providers/sync-transactions', {
      connection_id: 'conn-123',
      client_date: '2025-06-15',
      client_timezone: 'America/Chicago',
    });
  });
});
