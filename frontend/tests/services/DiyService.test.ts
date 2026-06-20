import { jest } from 'bun:test';
import { ApiClient } from '@/services/ApiClient';
import { DiyService } from '@/services/DiyService';

describe('DiyService', () => {
  let postSpy: jest.SpiedFunction<typeof ApiClient.post>;
  let deleteSpy: jest.SpiedFunction<typeof ApiClient.delete>;

  beforeEach(() => {
    jest.clearAllMocks();
    postSpy = jest.spyOn(ApiClient, 'post');
    deleteSpy = jest.spyOn(ApiClient, 'delete');
  });

  afterEach(() => {
    postSpy.mockRestore();
    deleteSpy.mockRestore();
  });

  it('creates a DIY institution through the dedicated endpoint', async () => {
    postSpy.mockResolvedValue({ connection_id: 'conn-1' } as never);

    const result = await DiyService.createInstitution('My Institution');

    expect(ApiClient.post).toHaveBeenCalledWith('/diy/institutions', {
      name: 'My Institution',
    });
    expect(result).toEqual({ connection_id: 'conn-1' });
  });

  it('creates a DIY account through the dedicated nested endpoint', async () => {
    postSpy.mockResolvedValue({
      id: 'acc-1',
      name: 'Checking',
      account_type: 'depository',
    } as never);

    const result = await DiyService.createAccount('conn-1', {
      name: 'Checking',
      account_type: 'depository',
      mask: '1234',
      balance: '1000.00',
    });

    expect(ApiClient.post).toHaveBeenCalledWith('/diy/institutions/conn-1/accounts', {
      name: 'Checking',
      account_type: 'depository',
      mask: '1234',
      balance: '1000.00',
    });
    expect(result).toEqual({ id: 'acc-1', name: 'Checking', account_type: 'depository' });
  });

  it('disconnects a DIY institution through the dedicated endpoint', async () => {
    deleteSpy.mockResolvedValue({
      success: true,
      message: 'Disconnected',
      data_cleared: { transactions: 2, accounts: 1, cache_keys: [] },
    } as never);

    const result = await DiyService.disconnectInstitution('conn-1');

    expect(ApiClient.delete).toHaveBeenCalledWith('/diy/institutions/conn-1');
    expect(result.success).toBe(true);
    expect(result.data_cleared.accounts).toBe(1);
  });
});
