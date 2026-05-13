import { TransactionService } from '@/services/TransactionService';

describe('TransactionService via ApiClient', () => {
  let fetchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTransactions', () => {
    it('should fetch transactions without filters using the default first page', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          transactions: [
            {
              id: 'txn-1',
              date: '2025-01-15',
              merchant_name: 'Coffee Shop',
              amount: 5.5,
              category_primary: 'Food & Drink',
              category_detailed: 'Coffee Shops',
              category_confidence: 'high',
              pending: false,
              account_id: 'acc-1',
            },
          ],
          total: 1,
          page: 1,
          page_size: 200,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchSpy.mockResolvedValueOnce(mockResponse);

      const transactions = await TransactionService.getTransactions();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/transactions?page=1&page_size=200'),
        expect.any(Object)
      );
      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe('txn-1');
    });

    it('should fetch a paginated response with page and page_size parameters', async () => {
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
          total: 25,
          page: 2,
          page_size: 10,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchSpy.mockResolvedValueOnce(mockResponse);

      const response = await TransactionService.getTransactions({
        page: 2,
        page_size: 10,
        search: 'coffee',
        categoryPrimary: 'Food & Drink',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/transactions?category_primary=Food+%26+Drink&search=coffee&page=2&page_size=10'
        ),
        expect.any(Object)
      );
      expect(response).toEqual({
        transactions: [
          expect.objectContaining({
            id: 'txn-2',
          }),
        ],
        total: 25,
        page: 2,
        page_size: 10,
      });
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

      await expect(
        TransactionService.getTransactions({ page: 1, page_size: 10 })
      ).rejects.toThrow();
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
          total: 1,
          page: 1,
          page_size: 10,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchSpy.mockResolvedValueOnce(mockResponse);

      const response = await TransactionService.getTransactions({ page: 1, page_size: 10 });

      expect(response.transactions).toHaveLength(1);
      expect(response.transactions[0].id).toBe('backend-id-1');
      expect(response.transactions[0].amount).toBe(-25.0);
    });
  });
});
