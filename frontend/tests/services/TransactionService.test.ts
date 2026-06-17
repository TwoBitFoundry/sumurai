import { jest } from 'bun:test';
import { ApiClient, AuthenticationError } from '@/services/ApiClient';
import { TransactionService } from '@/services/TransactionService';
import type { TransactionsInsightsResponse } from '@/types/api';

describe('TransactionService', () => {
  let getSpy: jest.SpiedFunction<typeof ApiClient.get>;
  let putSpy: jest.SpiedFunction<typeof ApiClient.put>;

  beforeEach(() => {
    jest.clearAllMocks();
    getSpy = jest.spyOn(ApiClient, 'get');
    putSpy = jest.spyOn(ApiClient, 'put');
  });

  afterEach(() => {
    getSpy.mockRestore();
    putSpy.mockRestore();
  });

  describe('getTransactionsPage', () => {
    it('fetches and transforms a filtered page of transactions', async () => {
      getSpy.mockResolvedValue({
        transactions: [
          {
            id: '1',
            date: '2024-01-15',
            merchant_name: 'Coffee Shop',
            amount: -5.5,
            category_primary: 'FOOD_AND_DRINK',
            category_detailed: 'COFFEE_SHOPS',
            category_confidence: 'HIGH',
            provider: 'plaid',
            account_name: 'Everyday Checking',
            account_type: 'depository',
            account_mask: '1234',
          },
        ],
        next_cursor: 'cursor-2',
        prev_cursor: null,
        has_more: true,
      } as any);

      const result = await TransactionService.getTransactionsPage({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        categoryId: 'FOOD_AND_DRINK',
        searchTerm: 'coffee',
        cursor: 'cursor-1',
        limit: 40,
      });

      expect(ApiClient.get).toHaveBeenCalledWith(
        '/transactions?start_date=2024-01-01&end_date=2024-01-31&category_primary=FOOD_AND_DRINK&search=coffee&cursor=cursor-1&limit=40'
      );
      expect(result).toEqual({
        transactions: [
          {
            id: '1',
            date: '2024-01-15',
            name: 'Coffee Shop',
            merchant: 'Coffee Shop',
            amount: -5.5,
            category: {
              primary: 'FOOD_AND_DRINK',
              detailed: 'COFFEE_SHOPS',
              confidence_level: 'HIGH',
            },
            account_name: 'Everyday Checking',
            account_type: 'depository',
            account_mask: '1234',
          },
        ],
        next_cursor: 'cursor-2',
        prev_cursor: null,
        has_more: true,
      });
    });

    it('should fetch transaction categories', async () => {
      getSpy.mockResolvedValue(['FOOD_AND_DRINK', 'TRANSPORTATION'] as any);

      const result = await TransactionService.getTransactionCategories();

      expect(ApiClient.get).toHaveBeenCalledWith('/transactions/categories');
      expect(result).toEqual(['FOOD_AND_DRINK', 'TRANSPORTATION']);
    });

    it('should fetch transaction insights without pagination parameters', async () => {
      const mockInsights: TransactionsInsightsResponse = {
        total_count: 3,
        total_spent: 60,
        average_amount: 20,
        largest: {
          amount: 30,
          merchant: 'Coffee Collective',
        },
        top_categories: ['FOOD_AND_DRINK'],
      };
      getSpy.mockResolvedValue(mockInsights as any);

      const result = await TransactionService.getTransactionsInsights({
        searchTerm: 'coffee',
        startDate: '2024-03-01',
        endDate: '2024-03-31',
        categoryPrimary: 'FOOD_AND_DRINK',
        accountIds: ['account1'],
      });

      expect(ApiClient.get).toHaveBeenCalledWith(
        '/transactions/insights?start_date=2024-03-01&end_date=2024-03-31&category_primary=FOOD_AND_DRINK&search=coffee&account_ids%5B%5D=account1'
      );
      expect(result).toEqual(mockInsights);
    });

    it('should handle authentication errors', async () => {
      getSpy.mockRejectedValue(new AuthenticationError());

      await expect(TransactionService.getTransactionsPage()).rejects.toThrow(AuthenticationError);
    });

    it('updates a transaction category without duplicating the api base path', async () => {
      putSpy.mockResolvedValue(undefined as any);

      await TransactionService.updateTransactionCategory('tx-1', 'Coffee', true);

      expect(putSpy).toHaveBeenCalledWith('/transactions/tx-1/category', {
        category_name: 'Coffee',
        is_custom: true,
      });
    });
  });
});
