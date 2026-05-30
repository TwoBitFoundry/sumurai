import { ApiClient } from '@/services/ApiClient';
import { SettingsService } from '@/services/SettingsService';

jest.mock('@/services/ApiClient', () => ({
  ApiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('SettingsService.deleteAccount — Given/When/Then', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Given authenticated user; When deleteAccount; Then sends DELETE request to /auth/account', async () => {
    jest.mocked(ApiClient.delete).mockResolvedValueOnce({
      message: 'Account deleted successfully',
      deleted_items: {
        connections: 1,
        transactions: 25,
        accounts: 2,
        budgets: 3,
      },
    } as any);

    const response = await SettingsService.deleteAccount();

    expect(ApiClient.delete).toHaveBeenCalledTimes(1);
    expect(jest.mocked(ApiClient.delete).mock.calls[0][0]).toBe('/auth/account');

    expect(response).toEqual({
      message: 'Account deleted successfully',
      deleted_items: {
        connections: 1,
        transactions: 25,
        accounts: 2,
        budgets: 3,
      },
    });
  });

  it('Given network error; When deleteAccount; Then propagates error', async () => {
    const err = new Error('Network error');
    jest.mocked(ApiClient.delete).mockRejectedValueOnce(err);

    await expect(SettingsService.deleteAccount()).rejects.toBe(err);
  });

  it('Given server error; When deleteAccount; Then propagates error', async () => {
    const err = new Error('500 Internal Server Error');
    jest.mocked(ApiClient.delete).mockRejectedValueOnce(err);

    await expect(SettingsService.deleteAccount()).rejects.toBe(err);
  });
});

describe('SettingsService interfaces — Type safety', () => {
  it('Given DeleteAccountResponse; When backend responds; Then includes message and deleted_items summary', () => {
    const response = {
      message: 'Account deleted successfully',
      deleted_items: {
        connections: 1,
        transactions: 25,
        accounts: 2,
        budgets: 3,
      },
    };
    expect(response).toHaveProperty('message');
    expect(response).toHaveProperty('deleted_items');
    expect(response.deleted_items).toHaveProperty('connections');
    expect(response.deleted_items).toHaveProperty('transactions');
    expect(response.deleted_items).toHaveProperty('accounts');
    expect(response.deleted_items).toHaveProperty('budgets');
  });
});
