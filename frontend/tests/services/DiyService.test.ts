import { jest } from 'bun:test';
import { ApiClient } from '@/services/ApiClient';
import { DiyService } from '@/services/DiyService';

describe('DiyService', () => {
  let postSpy: jest.SpiedFunction<typeof ApiClient.post>;

  beforeEach(() => {
    jest.clearAllMocks();
    postSpy = jest.spyOn(ApiClient, 'post');
  });

  afterEach(() => {
    postSpy.mockRestore();
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
    postSpy.mockResolvedValue({ id: 'acc-1', name: 'Checking', account_type: 'checking' } as never);

    const result = await DiyService.createAccount('conn-1', {
      name: 'Checking',
      account_type: 'checking',
      mask: '1234',
      balance: '1000.00',
    });

    expect(ApiClient.post).toHaveBeenCalledWith('/diy/institutions/conn-1/accounts', {
      name: 'Checking',
      account_type: 'checking',
      mask: '1234',
      balance: '1000.00',
    });
    expect(result).toEqual({ id: 'acc-1', name: 'Checking', account_type: 'checking' });
  });
});
