import { describe, it, expect } from 'vitest'
import { AccountNormalizer } from '@/domain/AccountNormalizer'

describe('AccountNormalizer', () => {
  describe('normalize', () => {
    it('should normalize account type from depository to checking', () => {
      const accounts = [{ id: '1', account_type: 'depository', name: 'Checking' }]
      const result = AccountNormalizer.normalize(accounts)
      expect(result[0].type).toBe('checking')
    })

    it('should normalize account type from credit card to credit', () => {
      const accounts = [{ id: '1', account_type: 'credit card', name: 'Credit Card' }]
      const result = AccountNormalizer.normalize(accounts)
      expect(result[0].type).toBe('credit')
    })

    it('should handle balance from various field names', () => {
      const accounts = [
        { id: '1', account_type: 'depository', name: 'Account', balance_current: 1000 },
        { id: '2', account_type: 'depository', name: 'Account', balance_ledger: 2000 },
        { id: '3', account_type: 'depository', name: 'Account', current_balance: 3000 },
      ]
      const result = AccountNormalizer.normalize(accounts)
      expect(result[0].balance).toBe(1000)
      expect(result[1].balance).toBe(2000)
      expect(result[2].balance).toBe(3000)
    })

    it('should handle mask from various field names', () => {
      const accounts = [
        { id: '1', account_type: 'depository', name: 'Account', mask: '1234' },
        { id: '2', account_type: 'depository', name: 'Account', last_four: '5678' },
        { id: '3', account_type: 'depository', name: 'Account', lastFour: '9012' },
      ]
      const result = AccountNormalizer.normalize(accounts)
      expect(result[0].mask).toBe('1234')
      expect(result[1].mask).toBe('5678')
      expect(result[2].mask).toBe('9012')
    })

    it('should handle connection_id from various field names', () => {
      const accounts = [
        { id: '1', account_type: 'depository', name: 'Account', provider_connection_id: 'conn1' },
        { id: '2', account_type: 'depository', name: 'Account', plaid_connection_id: 'conn2' },
        { id: '3', account_type: 'depository', name: 'Account', connection_id: 'conn3' },
      ]
      const result = AccountNormalizer.normalize(accounts)
      expect(result[0].connectionKey).toBe('conn1')
      expect(result[1].connectionKey).toBe('conn2')
      expect(result[2].connectionKey).toBe('conn3')
    })

    it('should set default values for missing fields', () => {
      const accounts = [{ id: '123' }]
      const result = AccountNormalizer.normalize(accounts)
      expect(result[0].id).toBe('123')
      expect(result[0].name).toBe('Account')
      expect(result[0].mask).toBe('0000')
      expect(result[0].type).toBe('other')
      expect(result[0].connectionKey).toBe(null)
      expect(result[0].balance).toBeUndefined()
    })

    it('should handle array of accounts', () => {
      const accounts = [
        { id: '1', name: 'Account 1', account_type: 'checking' },
        { id: '2', name: 'Account 2', account_type: 'savings' },
      ]
      const result = AccountNormalizer.normalize(accounts)
      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('checking')
      expect(result[1].type).toBe('savings')
    })
  })
})
