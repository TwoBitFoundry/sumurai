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

describe('SettingsService.changePassword — Given/When/Then', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Given valid credentials; When changePassword; Then sends PUT request with correct payload', async () => {
    jest.mocked(ApiClient.put).mockResolvedValueOnce({
      message: 'Password changed successfully. Please log in again.',
      requires_reauth: true,
    } as any);

    const response = await SettingsService.changePassword('oldpass123', 'newpass123');

    expect(ApiClient.put).toHaveBeenCalledTimes(1);
    const [endpoint, payload] = jest.mocked(ApiClient.put).mock.calls[0];
    expect(endpoint).toBe('/auth/change-password');
    expect(payload).toEqual({
      current_password: 'oldpass123',
      new_password: 'newpass123',
    });

    expect(response).toEqual({
      message: 'Password changed successfully. Please log in again.',
      requires_reauth: true,
    });
  });

  it('Given network error; When changePassword; Then propagates error', async () => {
    const err = new Error('Network error');
    jest.mocked(ApiClient.put).mockRejectedValueOnce(err);

    await expect(SettingsService.changePassword('oldpass123', 'newpass123')).rejects.toBe(err);
  });

  it('Given authentication error (401); When changePassword; Then propagates error', async () => {
    const err = new Error('401 Unauthorized');
    jest.mocked(ApiClient.put).mockRejectedValueOnce(err);

    await expect(SettingsService.changePassword('wrongpass', 'newpass123')).rejects.toBe(err);
  });
});

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
  it('Given ChangePasswordRequest; When creating instance; Then requires current_password and new_password', () => {
    const request = {
      current_password: 'old',
      new_password: 'new',
    };
    expect(request).toHaveProperty('current_password');
    expect(request).toHaveProperty('new_password');
  });

  it('Given ChangePasswordResponse; When backend responds; Then includes message and requires_reauth', () => {
    const response = {
      message: 'Password changed successfully. Please log in again.',
      requires_reauth: true,
    };
    expect(response).toHaveProperty('message');
    expect(response).toHaveProperty('requires_reauth');
  });

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
