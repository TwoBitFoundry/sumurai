import { TransactionService } from '@/services/TransactionService';

describe('TransactionService via ApiClient', () => {
  let fetchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTransactionsPage', () => {
    it('should fetch a filtered transaction page with cursor params', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          transactions: [
            {
              id: 'txn-2',
              date: '2025-01-16',
              merchant_name: 'Grocery Store',
              amount: 45.75,
              category_primary: 'Groceries',
              category_detailed: 'Supermarkets',
              category_confidence: 'high',
              pending: false,
              account_id: 'acc-1',
            },
          ],
          next_cursor: 'cursor-2',
          prev_cursor: null,
          has_more: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchSpy.mockResolvedValueOnce(mockResponse);

      const response = await TransactionService.getTransactionsPage({
        search: 'coffee',
        categoryPrimary: 'Food & Drink',
        cursor: 'cursor-1',
        limit: 40,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/transactions?category_primary=Food+%26+Drink&search=coffee&cursor=cursor-1&limit=40'
        ),
        expect.any(Object)
      );
      expect(response).toEqual(
        expect.objectContaining({
          next_cursor: 'cursor-2',
          prev_cursor: null,
          has_more: true,
        })
      );
      expect(response.transactions).toHaveLength(1);
      expect(response.transactions[0].id).toBe('txn-2');
    });

    it('should fetch transaction categories', async () => {
      const mockResponse = new Response(JSON.stringify(['Groceries', 'Utilities']), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      fetchSpy.mockResolvedValueOnce(mockResponse);

      const categories = await TransactionService.getTransactionCategories();

      expect(fetchSpy).toHaveBeenCalledWith('/api/transactions/categories', expect.any(Object));
      expect(categories).toEqual(['Groceries', 'Utilities']);
    });

    it('should handle error responses gracefully', async () => {
      const mockResponse = new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
      fetchSpy.mockResolvedValueOnce(mockResponse);

      await expect(TransactionService.getTransactionsPage()).rejects.toThrow();
    });

    it('should transform backend transaction format to frontend format', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          transactions: [
            {
              id: 'backend-id-1',
              date: '2025-01-15',
              merchant_name: 'Test Merchant',
              amount: -25.0,
              category_primary: 'Test Category',
              category_detailed: 'Test Detail',
              category_confidence: 'high',
              pending: false,
              account_id: 'acc-1',
            },
          ],
          next_cursor: null,
          prev_cursor: null,
          has_more: false,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchSpy.mockResolvedValueOnce(mockResponse);

      const response = await TransactionService.getTransactionsPage();

      expect(response.transactions).toHaveLength(1);
      expect(response.transactions[0].id).toBe('backend-id-1');
      expect(response.transactions[0].amount).toBe(-25.0);
    });
  });
});
