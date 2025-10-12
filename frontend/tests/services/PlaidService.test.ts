import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlaidService } from '@/services/PlaidService'
import { ApiClient, AuthenticationError } from '@/services/ApiClient'
import type {
  PlaidLinkTokenResponse,
  PlaidExchangeTokenRequest,
  PlaidExchangeTokenResponse,
  PlaidSyncResponse,
  ProviderStatusResponse,
  Account
} from '@/types/api'

vi.mock('@/services/ApiClient')

describe('PlaidService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getLinkToken', () => {
    it('should call authenticated endpoint for Plaid link token', async () => {
      const mockResponse: PlaidLinkTokenResponse = {
        link_token: 'link-sandbox-abc123'
      }
      vi.mocked(ApiClient.post).mockResolvedValue(mockResponse)

      const result = await PlaidService.getLinkToken()

      expect(ApiClient.post).toHaveBeenCalledWith('/plaid/link-token', {})
      expect(result).toEqual(mockResponse)
    })

    it('should handle authentication errors', async () => {
      vi.mocked(ApiClient.post).mockRejectedValue(new AuthenticationError())

      await expect(PlaidService.getLinkToken())
        .rejects.toThrow(AuthenticationError)
    })
  })

  describe('exchangeToken', () => {
    it('should call authenticated endpoint to exchange public token', async () => {
      const publicToken = 'public-sandbox-xyz789'
      const mockResponse: PlaidExchangeTokenResponse = {
        access_token: 'access-sandbox-abc123-encrypted'
      }
      vi.mocked(ApiClient.post).mockResolvedValue(mockResponse)

      const result = await PlaidService.exchangeToken(publicToken)

      expect(ApiClient.post).toHaveBeenCalledWith('/plaid/exchange-token', {
        public_token: publicToken
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getAccounts', () => {
    it('should call authenticated endpoint for user accounts', async () => {
      const mockAccounts: Account[] = [
        {
          id: 'account-1',
          name: 'Checking Account',
          provider: 'plaid',
          account_type: 'depository',
          account_subtype: null,
          balance_ledger: 1250.50,
          balance_available: 1200.0,
          mask: '1111',
          status: 'active',
          institution_name: 'Mock Bank',
          connection_id: 'conn_1'
        }
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(mockAccounts)

      const result = await PlaidService.getAccounts()

      expect(ApiClient.get).toHaveBeenCalledWith('/plaid/accounts')
      expect(result).toEqual(mockAccounts)
    })

    it('should NOT perform any account data transformation', async () => {
      const rawAccounts: Account[] = [
        {
          id: 'weird-id-format',
          name: 'Account with Spaces and $pecial Ch@rs',
          provider: 'plaid',
          account_type: 'unknown_type',
          account_subtype: null,
          balance_ledger: -500.75,
          balance_available: -500.75,
          mask: null,
          status: null,
          institution_name: null,
          connection_id: 'conn_x'
        }
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(rawAccounts)

      const result = await PlaidService.getAccounts()

      expect(result).toEqual(rawAccounts)
      expect(result[0].balance_ledger).toBe(-500.75)
      expect(result[0].name).toBe('Account with Spaces and $pecial Ch@rs')
    })
  })

  describe('syncTransactions', () => {
    it('should call authenticated endpoint to sync transactions without connection_id (legacy)', async () => {
      const mockResponse: PlaidSyncResponse = {
        transactions: [
          {
            id: 'txn-1',
            date: '2025-01-15',
            name: 'Coffee Shop',
            amount: 4.50,
            category: { primary: 'FOOD_AND_DRINK', detailed: 'COFFEE' },
            provider: 'plaid',
            account_name: 'Checking',
            account_type: 'depository'
          }
        ],
        metadata: {
          transaction_count: 1,
          account_count: 2,
          sync_timestamp: '2025-01-20T10:30:00Z',
          start_date: '2025-01-01',
          end_date: '2025-01-20',
          connection_updated: true
        }
      }
      vi.mocked(ApiClient.post).mockResolvedValue(mockResponse)

      const result = await PlaidService.syncTransactions()

      expect(ApiClient.post).toHaveBeenCalledWith('/plaid/sync-transactions', {})
      expect(result).toEqual(mockResponse)
    })
    
    it('should call authenticated endpoint to sync transactions with connection_id for bank-level sync', async () => {
      const connectionId = 'bank-connection-123'
      const mockResponse: PlaidSyncResponse = {
        transactions: [
          {
            id: 'txn-1',
            date: '2025-01-15',
            name: 'Coffee Shop',
            amount: 4.50,
            category: { primary: 'FOOD_AND_DRINK', detailed: 'COFFEE' },
            provider: 'plaid',
            account_name: 'Checking',
            account_type: 'depository'
          }
        ],
        metadata: {
          transaction_count: 15,
          account_count: 3,
          sync_timestamp: '2025-01-20T10:30:00Z',
          start_date: '2025-01-17',
          end_date: '2025-01-20',
          connection_updated: true
        }
      }
      vi.mocked(ApiClient.post).mockResolvedValue(mockResponse)

      const result = await PlaidService.syncTransactions(connectionId)

      expect(ApiClient.post).toHaveBeenCalledWith('/plaid/sync-transactions', {
        connection_id: connectionId
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle incremental sync response with updated date ranges', async () => {
      const mockIncrementalResponse: PlaidSyncResponse = {
        transactions: [],
        metadata: {
          transaction_count: 125,
          account_count: 3,
          sync_timestamp: '2025-01-20T15:45:00Z',
          start_date: '2025-01-17', // Shows incremental sync from 3 days ago
          end_date: '2025-01-20',
          connection_updated: true
        }
      }
      vi.mocked(ApiClient.post).mockResolvedValue(mockIncrementalResponse)

      const result = await PlaidService.syncTransactions()

      expect(result.metadata.start_date).toBe('2025-01-17')
      expect(result.metadata.end_date).toBe('2025-01-20')
      expect(result.metadata.transaction_count).toBe(125)
    })
  })

  describe('getStatus', () => {
    it('should call authenticated endpoint for Plaid connection status', async () => {
      const mockStatus: ProviderStatusResponse = {
        provider: 'plaid',
        connections: [
          {
            is_connected: true,
            last_sync_at: '2024-01-15T10:30:00Z',
            institution_name: 'Bank A',
            connection_id: 'conn-123',
            transaction_count: 25,
            account_count: 2,
            sync_in_progress: false,
          }
        ]
      }
      vi.mocked(ApiClient.get).mockResolvedValue(mockStatus)

      const result = await PlaidService.getStatus()

      expect(ApiClient.get).toHaveBeenCalledWith('/providers/status')
      expect(result).toEqual(mockStatus)
    })
  })

  describe('disconnect', () => {
    it('should call authenticated endpoint to disconnect Plaid', async () => {
      const mockResponse = { 
        success: true, 
        message: 'Successfully disconnected',
        data_cleared: {
          transactions: 42,
          accounts: 2,
          cache_keys: ['cache_key_1', 'cache_key_2']
        }
      }
      vi.mocked(ApiClient.post).mockResolvedValue(mockResponse)

      const result = await PlaidService.disconnect('conn-123')

      expect(ApiClient.post).toHaveBeenCalledWith('/plaid/disconnect', { connection_id: 'conn-123' })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('clearSyncedData', () => {
    it('should call authenticated endpoint to clear synced data', async () => {
      const mockResponse = { cleared: true }
      vi.mocked(ApiClient.post).mockResolvedValue(mockResponse)

      const result = await PlaidService.clearSyncedData()

      expect(ApiClient.post).toHaveBeenCalledWith('/plaid/clear-synced-data')
      expect(result).toEqual(mockResponse)
    })
  })
})
