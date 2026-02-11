import { jest } from '@jest/globals';
import { ApiClient, AuthenticationError } from '@/services/ApiClient';
import { TransactionService } from '@/services/TransactionService';
import type { Transaction } from '@/types/api';

describe('TransactionService', () => {
  let getSpy: jest.SpiedFunction<typeof ApiClient.get>;

  beforeEach(() => {
    jest.clearAllMocks();
    getSpy = jest.spyOn(ApiClient, 'get');
  });

  afterEach(() => {
    getSpy.mockRestore();
  });

  describe('getTransactions', () => {
    it('should call authenticated API endpoint without parameters', async () => {
      const mockBackendTransactions = [
        {
          id: '1',
          date: '2024-01-15',
          merchant_name: 'SuperMarket Inc',
          amount: 45.5,
          category_primary: 'FOOD_AND_DRINK',
          category_detailed: 'FOOD_AND_DRINK_GROCERIES',
          category_confidence: 'HIGH',
          provider: 'plaid',
          account_name: 'Everyday Checking',
          account_type: 'depository',
          account_mask: '1234',
        },
      ];
      const expectedFrontendTransactions: Transaction[] = [
        {
          id: '1',
          date: '2024-01-15',
          name: 'SuperMarket Inc',
          merchant: 'SuperMarket Inc',
          amount: 45.5,
          category: {
            primary: 'FOOD_AND_DRINK',
            detailed: 'FOOD_AND_DRINK_GROCERIES',
            confidence_level: 'HIGH',
          },
          account_name: 'Everyday Checking',
          account_type: 'depository',
          account_mask: '1234',
        },
      ];
      getSpy.mockResolvedValue(mockBackendTransactions as any);

      const result = await TransactionService.getTransactions();

      expect(ApiClient.get).toHaveBeenCalledWith('/transactions');
      expect(result).toEqual(expectedFrontendTransactions);
    });

    it('should pass filter parameters to backend for server-side processing', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        categoryId: 'food',
        searchTerm: 'grocery',
      };
      const mockBackendTransactions: any[] = [];
      getSpy.mockResolvedValue(mockBackendTransactions as any);

      const result = await TransactionService.getTransactions(filters);

      expect(ApiClient.get).toHaveBeenCalledWith(
        '/transactions?startDate=2024-01-01&endDate=2024-01-31&categoryId=food&searchTerm=grocery'
      );
      expect(result).toEqual([]);
    });

    it('should handle authentication errors', async () => {
      getSpy.mockRejectedValue(new AuthenticationError());

      await expect(TransactionService.getTransactions()).rejects.toThrow(AuthenticationError);
    });

    it('should serialize account_ids parameter when provided', async () => {
      const filters = {
        accountIds: ['acc_1', 'acc_2', 'acc_3'],
      };
      const mockBackendTransactions: any[] = [];
      getSpy.mockResolvedValue(mockBackendTransactions as any);

      const result = await TransactionService.getTransactions(filters);

      expect(ApiClient.get).toHaveBeenCalledWith(
        '/transactions?account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2&account_ids%5B%5D=acc_3'
      );
      expect(result).toEqual([]);
    });

    it('should combine account_ids with other filters', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        accountIds: ['acc_1', 'acc_2'],
      };
      const mockBackendTransactions: any[] = [];
      getSpy.mockResolvedValue(mockBackendTransactions as any);

      const result = await TransactionService.getTransactions(filters);

      expect(ApiClient.get).toHaveBeenCalledWith(
        '/transactions?startDate=2024-01-01&endDate=2024-01-31&account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2'
      );
      expect(result).toEqual([]);
    });

    it('normalizes teller specific metadata without client filtering', async () => {
      const backendTransactions = [
        {
          id: '1',
          date: '2024-01-15',
          merchant_name: 'Ledger Update',
          amount: -100,
          category_primary: 'GENERAL',
          provider: 'teller',
          running_balance: 900.12,
          account_name: 'Main Checking',
          account_type: 'depository',
        },
        {
          id: '2',
          date: '2023-12-01',
          merchant_name: 'Legacy Payment',
          amount: 50,
          category_primary: 'UTILITIES',
          provider: 'teller',
          running_balance: 950.12,
          account_name: 'Main Checking',
          account_type: 'depository',
        },
      ];
      const expectedFrontendTransactions: Transaction[] = [
        {
          id: '1',
          date: '2024-01-15',
          name: 'Ledger Update',
          merchant: 'Ledger Update',
          amount: -100,
          category: {
            primary: 'GENERAL',
          },
          running_balance: 900.12,
          account_name: 'Main Checking',
          account_type: 'depository',
          account_mask: undefined,
        },
        {
          id: '2',
          date: '2023-12-01',
          name: 'Legacy Payment',
          merchant: 'Legacy Payment',
          amount: 50,
          category: {
            primary: 'UTILITIES',
          },
          running_balance: 950.12,
          account_name: 'Main Checking',
          account_type: 'depository',
          account_mask: undefined,
        },
      ];
      jest.mocked(ApiClient.get).mockResolvedValue(backendTransactions);

      const result = await TransactionService.getTransactions();

      expect(result).toEqual(expectedFrontendTransactions);
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('provider');
    });
  });
});
