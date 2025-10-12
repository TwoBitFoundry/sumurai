import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { usePlaidConnection } from '@/hooks/usePlaidConnection'
import { ApiClient } from '@/services/ApiClient'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures'

describe('usePlaidConnection Hook', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Disable retries to avoid timing flakiness and undefined fetch behaviors on subsequent attempts
    ApiClient.setTestMaxRetries(0)
    
    // Default routes
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'POST /api/plaid/disconnect': {
        success: true,
        message: 'Successfully disconnected',
        data_cleared: {
          transactions: 0,
          accounts: 0,
          cache_keys: []
        }
      }
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Given the hook is initialized', () => {
    describe('When no previous connection exists', () => {
      it('Then it should return disconnected state', async () => {

        const { result } = renderHook(() => usePlaidConnection())

        expect(result.current.loading).toBe(true)
        expect(result.current.isConnected).toBe(false)

        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })

        expect(result.current.isConnected).toBe(false)
        expect(result.current.lastSyncAt).toBe(null)
        expect(result.current.institutionName).toBe(null)
        expect(result.current.transactionCount).toBe(0)
        expect(result.current.accountCount).toBe(0)
        expect(result.current.syncInProgress).toBe(false)
      })
    })

    describe('When previous connection exists', () => {
      it('Then it should load and return connected state', async () => {
        const mockConnectionData = createProviderConnection({
          is_connected: true,
          last_sync_at: '2024-01-15T10:30:00Z',
          institution_name: 'Chase Bank',
          connection_id: 'conn_123',
          transaction_count: 25,
          account_count: 2,
          sync_in_progress: false,
        })
        
        installFetchRoutes({
          'GET /api/providers/status': createProviderStatus({ connections: [mockConnectionData] })
        })

        const { result } = renderHook(() => usePlaidConnection())

        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })

        expect(result.current.isConnected).toBe(true)
        expect(result.current.lastSyncAt).toBe('2024-01-15T10:30:00Z')
        expect(result.current.institutionName).toBe('Chase Bank')
        expect(result.current.transactionCount).toBe(25)
        expect(result.current.accountCount).toBe(2)
        expect(result.current.syncInProgress).toBe(false)
      })
    })

    describe('When API call fails', () => {
      it('Then it should handle error gracefully', async () => {
        installFetchRoutes({
          'GET /api/providers/status': new Response('Network error', { status: 500 })
        })

        const { result } = renderHook(() => usePlaidConnection())

        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })

        expect(result.current.isConnected).toBe(false)
        expect(result.current.error).toBe('Failed to load connection status')
      })
    })
  })

  describe('Given the hook is managing connection state', () => {
    describe('When markConnected is called', () => {
      it('Then it should update state to connected', async () => {

        const { result } = renderHook(() => usePlaidConnection())

        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })

        act(() => {
          result.current.markConnected('Wells Fargo', 'conn_456')
        })

        expect(result.current.isConnected).toBe(true)
        expect(result.current.institutionName).toBe('Wells Fargo')
      })
    })

    describe('When disconnect is called', () => {
      it('Then it should call API and update state to disconnected', async () => {
        installFetchRoutes({
          'GET /api/providers/status': createProviderStatus({
            connections: [
              createProviderConnection({
                is_connected: true,
                last_sync_at: '2024-01-15T10:30:00Z',
                institution_name: 'Chase Bank',
                connection_id: 'conn_123',
                transaction_count: 25,
                account_count: 2,
                sync_in_progress: false,
              }),
            ],
          }),
          'POST /api/plaid/disconnect': {
            success: true,
            message: 'Successfully disconnected',
            data_cleared: {
              transactions: 25,
              accounts: 2,
              cache_keys: ['access_token:item_123']
            }
          }
        })

        const { result } = renderHook(() => usePlaidConnection())

        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })

        expect(result.current.isConnected).toBe(true)

        await act(async () => {
          await result.current.disconnect()
        })

        // Assert visible hook state changes (focus on behavior, not implementation)
        expect(result.current.isConnected).toBe(false)
        expect(result.current.lastSyncAt).toBe(null)
        expect(result.current.institutionName).toBe(null)
        expect(result.current.transactionCount).toBe(0)
        expect(result.current.accountCount).toBe(0)
      })
    })

    describe('When updateSyncInfo is called', () => {
      it('Then it should update sync metadata', async () => {
        installFetchRoutes({
          'GET /api/providers/status': createProviderStatus({
            connections: [
              createProviderConnection({
                is_connected: true,
                last_sync_at: '2024-01-15T10:30:00Z',
                institution_name: 'Chase Bank',
                connection_id: 'conn_123',
                transaction_count: 25,
                account_count: 2,
                sync_in_progress: false,
              }),
            ],
          }),
        })

        const { result } = renderHook(() => usePlaidConnection())

        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })

        const newSyncTime = '2024-01-15T15:45:00Z'
        act(() => {
          result.current.updateSyncInfo(30, 3, newSyncTime)
        })

        expect(result.current.transactionCount).toBe(30)
        expect(result.current.accountCount).toBe(3)
        expect(result.current.lastSyncAt).toBe(newSyncTime)
      })
    })

    describe('When refresh is called', () => {
      it('Then it should fetch latest connection status', async () => {
        // Start with disconnected state, then set up to return connected state on refresh
        installFetchRoutes({
          'GET /api/providers/status': createProviderStatus({
            connections: [createProviderConnection()],
          }),
        })

        const { result } = renderHook(() => usePlaidConnection())

        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })

        expect(result.current.isConnected).toBe(false)

        // Override route for refresh call
        installFetchRoutes({
          'GET /api/providers/status': createProviderStatus({
            connections: [
              createProviderConnection({
                is_connected: true,
                last_sync_at: '2024-01-15T16:00:00Z',
                institution_name: 'Bank of America',
                connection_id: 'conn_789',
                transaction_count: 40,
                account_count: 3,
                sync_in_progress: false,
              }),
            ],
          }),
        })

        await act(async () => {
          await result.current.refresh()
        })

        expect(result.current.isConnected).toBe(true)
        expect(result.current.institutionName).toBe('Bank of America')
        expect(result.current.transactionCount).toBe(40)
        expect(result.current.accountCount).toBe(3)
      })
    })
  })

  describe('Given sync operations', () => {
    describe('When setSyncInProgress is called', () => {
      it('Then it should update sync progress state', async () => {
        installFetchRoutes({
          'GET /api/providers/status': createProviderStatus({
            connections: [
              createProviderConnection({
                is_connected: true,
                last_sync_at: '2024-01-15T10:30:00Z',
                institution_name: 'Chase Bank',
                connection_id: 'conn_123',
                transaction_count: 25,
                account_count: 2,
                sync_in_progress: false,
              }),
            ],
          }),
        })

        const { result } = renderHook(() => usePlaidConnection())

        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })

        expect(result.current.syncInProgress).toBe(false)

        act(() => {
          result.current.setSyncInProgress(true)
        })

        expect(result.current.syncInProgress).toBe(true)

        act(() => {
          result.current.setSyncInProgress(false)
        })

        expect(result.current.syncInProgress).toBe(false)
      })
    })
  })
})
