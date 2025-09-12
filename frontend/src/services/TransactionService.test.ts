import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionService } from './TransactionService'
import { ApiClient, AuthenticationError } from './ApiClient'
import type { Transaction } from '../types/api'

vi.mock('./ApiClient')

describe('TransactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTransactions', () => {
    it('should call authenticated API endpoint without parameters', async () => {
      const mockBackendTransactions = [
        {
          id: '1',
          date: '2024-01-15',
          merchant_name: 'SuperMarket Inc',
          amount: 45.50,
          category_primary: 'food_and_dining'
        }
      ]
      const expectedFrontendTransactions: Transaction[] = [
        {
          id: '1',
          date: '2024-01-15',
          name: 'SuperMarket Inc',
          merchant: 'SuperMarket Inc',
          amount: 45.50,
          category: { id: 'food_and_dining', name: 'Food And Dining' }
        }
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(mockBackendTransactions)

      const result = await TransactionService.getTransactions()

      expect(ApiClient.get).toHaveBeenCalledWith('/transactions')
      expect(result).toEqual(expectedFrontendTransactions)
    })

    it('should pass filter parameters to backend for server-side processing', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        categoryId: 'food',
        searchTerm: 'grocery'
      }
      const mockBackendTransactions: any[] = []
      vi.mocked(ApiClient.get).mockResolvedValue(mockBackendTransactions)

      const result = await TransactionService.getTransactions(filters)

      expect(ApiClient.get).toHaveBeenCalledWith(
        '/transactions?startDate=2024-01-01&endDate=2024-01-31&categoryId=food&searchTerm=grocery'
      )
      expect(result).toEqual([])
    })

    it('should handle authentication errors', async () => {
      vi.mocked(ApiClient.get).mockRejectedValue(new AuthenticationError())

      await expect(TransactionService.getTransactions())
        .rejects.toThrow(AuthenticationError)
    })

    it('should NOT perform any client-side filtering or business logic', async () => {
      const backendTransactions = [
        {
          id: '1',
          date: '2024-01-15',
          merchant_name: 'Old Transaction',
          amount: -100,
          category_primary: 'food'
        },
        {
          id: '2', 
          date: '2023-12-01',
          merchant_name: 'Very Old Transaction',
          amount: 50,
          category_primary: 'gas'
        }
      ]
      const expectedFrontendTransactions: Transaction[] = [
        {
          id: '1',
          date: '2024-01-15',
          name: 'Old Transaction',
          merchant: 'Old Transaction',
          amount: -100,
          category: { id: 'food', name: 'Food' }
        },
        {
          id: '2', 
          date: '2023-12-01',
          name: 'Very Old Transaction',
          merchant: 'Very Old Transaction',
          amount: 50,
          category: { id: 'gas', name: 'Gas' }
        }
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(backendTransactions)

      const result = await TransactionService.getTransactions()

      expect(result).toEqual(expectedFrontendTransactions)
      expect(result[0].amount).toBe(-100)
      expect(result).toHaveLength(2)
    })
  })
})
