import { TransactionService } from '@/services/TransactionService'

describe('TransactionService via ApiClient', () => {
  let fetchSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getTransactions', () => {
    it('should fetch transactions without filters', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          date: '2025-01-15',
          name: 'Coffee Shop',
          merchant_name: 'Starbucks',
          amount: 5.50,
          category_primary: 'Food & Drink',
          category_detailed: 'Coffee Shops',
          category_confidence: 'high',
          pending: false,
          account_id: 'acc-1'
        }
      ]

      const mockResponse = new Response(JSON.stringify(mockTransactions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      const transactions = await TransactionService.getTransactions()

      expect(fetchSpy).toHaveBeenCalledWith('/api/transactions', expect.any(Object))
      expect(transactions).toHaveLength(1)
      expect(transactions[0].id).toBe('txn-1')
    })

    it('should fetch transactions with start and end date filters', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          date: '2025-01-15',
          name: 'Coffee Shop',
          merchant_name: 'Starbucks',
          amount: 5.50,
          category_primary: 'Food & Drink',
          category_detailed: 'Coffee Shops',
          category_confidence: 'high',
          pending: false,
          account_id: 'acc-1'
        },
        {
          id: 'txn-2',
          date: '2025-01-16',
          name: 'Grocery Store',
          merchant_name: 'Whole Foods',
          amount: 45.75,
          category_primary: 'Groceries',
          category_detailed: 'Supermarkets',
          category_confidence: 'high',
          pending: false,
          account_id: 'acc-1'
        }
      ]

      const mockResponse = new Response(JSON.stringify(mockTransactions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      const transactions = await TransactionService.getTransactions({
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      })

      const callArgs = fetchSpy.mock.calls[0]
      expect(callArgs[0]).toContain('/api/transactions')
      expect(callArgs[0]).toContain('startDate=2025-01-01')
      expect(callArgs[0]).toContain('endDate=2025-01-31')
      expect(transactions).toHaveLength(2)
    })

    it('should fetch transactions with category filter', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          date: '2025-01-15',
          name: 'Coffee Shop',
          merchant_name: 'Starbucks',
          amount: 5.50,
          category_primary: 'Food & Drink',
          category_detailed: 'Coffee Shops',
          category_confidence: 'high',
          pending: false,
          account_id: 'acc-1'
        }
      ]

      const mockResponse = new Response(JSON.stringify(mockTransactions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      const transactions = await TransactionService.getTransactions({
        categoryId: 'cat-food'
      })

      const callArgs = fetchSpy.mock.calls[0]
      expect(callArgs[0]).toContain('categoryId=cat-food')
      expect(transactions).toHaveLength(1)
    })

    it('should fetch transactions with search filter', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          date: '2025-01-15',
          name: 'Starbucks Coffee',
          merchant_name: 'Starbucks',
          amount: 5.50,
          category_primary: 'Food & Drink',
          category_detailed: 'Coffee Shops',
          category_confidence: 'high',
          pending: false,
          account_id: 'acc-1'
        }
      ]

      const mockResponse = new Response(JSON.stringify(mockTransactions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      const transactions = await TransactionService.getTransactions({
        search: 'coffee'
      })

      const callArgs = fetchSpy.mock.calls[0]
      expect(callArgs[0]).toContain('search=coffee')
      expect(transactions).toHaveLength(1)
    })

    it('should handle error responses gracefully', async () => {
      const mockResponse = new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      await expect(TransactionService.getTransactions()).rejects.toThrow()
    })

    it('should transform backend transaction format to frontend format', async () => {
      const mockTransactions = [
        {
          id: 'backend-id-1',
          date: '2025-01-15',
          name: 'Test Transaction',
          merchant_name: 'Test Merchant',
          amount: -25.00,
          category_primary: 'Test Category',
          category_detailed: 'Test Detail',
          category_confidence: 'high',
          pending: false,
          account_id: 'acc-1'
        }
      ]

      const mockResponse = new Response(JSON.stringify(mockTransactions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
      fetchSpy.mockResolvedValueOnce(mockResponse)

      const transactions = await TransactionService.getTransactions()

      expect(transactions).toHaveLength(1)
      expect(transactions[0].id).toBe('backend-id-1')
      expect(transactions[0].amount).toBe(-25.00)
    })
  })
})
