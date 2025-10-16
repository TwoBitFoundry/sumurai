import { describe, it, expect } from 'vitest'
import { TransactionTransformer } from '@/domain/TransactionTransformer'

describe('TransactionTransformer', () => {
  describe('backendToFrontend', () => {
    it('should transform backend transaction to frontend format', () => {
      const backendTxn = {
        id: 'txn123',
        date: '2024-01-15',
        merchant_name: 'Starbucks',
        amount: 5.50,
        category_primary: 'FOOD_AND_DRINK',
        account_name: 'Checking Account',
        account_type: 'checking',
      }
      const result = TransactionTransformer.backendToFrontend(backendTxn)
      expect(result.id).toBe('txn123')
      expect(result.date).toBe('2024-01-15')
      expect(result.name).toBe('Starbucks')
      expect(result.amount).toBe(5.50)
      expect(result.merchant).toBe('Starbucks')
      expect(result.category.primary).toBe('FOOD_AND_DRINK')
      expect(result.account_name).toBe('Checking Account')
      expect(result.account_type).toBe('checking')
    })

    it('should set default values for missing optional fields', () => {
      const backendTxn = {
        id: 'txn123',
        date: '2024-01-15',
        amount: 100,
        account_name: 'Checking',
        account_type: 'checking',
      }
      const result = TransactionTransformer.backendToFrontend(backendTxn)
      expect(result.name).toBe('Unknown')
      expect(result.merchant).toBeUndefined()
      expect(result.category.primary).toBe('OTHER')
      expect(result.category.detailed).toBeUndefined()
    })

    it('should include category details when present', () => {
      const backendTxn = {
        id: 'txn123',
        date: '2024-01-15',
        amount: 100,
        category_primary: 'SHOPPING',
        category_detailed: 'General Merchandise',
        category_confidence: 'HIGH',
        account_name: 'Checking',
        account_type: 'checking',
      }
      const result = TransactionTransformer.backendToFrontend(backendTxn)
      expect(result.category.detailed).toBe('General Merchandise')
      expect(result.category.confidence_level).toBe('HIGH')
    })

    it('should include account_mask and running_balance when present', () => {
      const backendTxn = {
        id: 'txn123',
        date: '2024-01-15',
        amount: 100,
        account_name: 'Checking',
        account_type: 'checking',
        account_mask: '1234',
        running_balance: 5000,
      }
      const result = TransactionTransformer.backendToFrontend(backendTxn)
      expect(result.account_mask).toBe('1234')
      expect(result.running_balance).toBe(5000)
    })

    it('should include location when present', () => {
      const backendTxn = {
        id: 'txn123',
        date: '2024-01-15',
        amount: 100,
        account_name: 'Checking',
        account_type: 'checking',
        location: { city: 'San Francisco', state: 'CA' },
      }
      const result = TransactionTransformer.backendToFrontend(backendTxn)
      expect(result.location).toEqual({ city: 'San Francisco', state: 'CA' })
    })
  })
})
