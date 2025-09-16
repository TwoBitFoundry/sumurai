import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { usePlaidLinkFlow } from './usePlaidLinkFlow'

const plaidLinkMock = vi.hoisted(() => {
  const open = vi.fn()
  let config: any = null
  return {
    open,
    getConfig: () => config,
    reset: () => {
      config = null
      open.mockReset()
    },
    setConfig: (opts: any) => {
      config = opts
    },
  }
})

const plaidConnectionsMock = vi.hoisted(() => ({
  connections: [] as any[],
  loading: false,
  error: null as string | null,
  addConnection: vi.fn(),
  removeConnection: vi.fn(),
  updateConnectionSyncInfo: vi.fn(),
  setConnectionSyncInProgress: vi.fn(),
  refresh: vi.fn(),
  getConnection: vi.fn(),
}))

const plaidServiceMock = vi.hoisted(() => ({
  getStatus: vi.fn(),
  exchangeToken: vi.fn(),
  syncTransactions: vi.fn(),
  disconnect: vi.fn(),
}))

const apiClientMock = vi.hoisted(() => ({
  post: vi.fn(),
}))

vi.mock('react-plaid-link', () => ({
  usePlaidLink: (opts: any) => {
    plaidLinkMock.setConfig(opts)
    return { open: plaidLinkMock.open, ready: true }
  },
}))

vi.mock('../../../hooks/usePlaidConnections', () => ({
  usePlaidConnections: () => plaidConnectionsMock,
}))

vi.mock('../../../services/PlaidService', () => ({
  PlaidService: plaidServiceMock,
}))

vi.mock('../../../services/ApiClient', () => ({
  ApiClient: apiClientMock,
}))

describe('usePlaidLinkFlow', () => {
  beforeEach(() => {
    plaidConnectionsMock.connections = []
    plaidConnectionsMock.loading = false
    plaidConnectionsMock.error = null
    plaidConnectionsMock.addConnection.mockReset()
    plaidConnectionsMock.removeConnection.mockReset()
    plaidConnectionsMock.updateConnectionSyncInfo.mockReset()
    plaidConnectionsMock.setConnectionSyncInProgress.mockReset()
    plaidConnectionsMock.refresh.mockReset()
    plaidConnectionsMock.getConnection.mockReset()
    plaidLinkMock.reset()
    Object.values(plaidServiceMock).forEach(fn => fn.mockReset())
    apiClientMock.post.mockReset()
  })

  it('exchanges token and refreshes status on success', async () => {
    const onError = vi.fn()
    plaidConnectionsMock.refresh.mockResolvedValue([])
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-123' })
    plaidServiceMock.exchangeToken.mockResolvedValueOnce({ access_token: 'access' } as any)
    plaidServiceMock.getStatus.mockResolvedValueOnce({
      connected: true,
      institution_name: 'Test Bank',
      connection_id: 'conn-1',
    } as any)

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }))

    await act(async () => {
      await result.current.connect()
    })

    expect(apiClientMock.post).toHaveBeenCalledWith('/plaid/link-token', expect.any(Object))
    expect(plaidLinkMock.open).toHaveBeenCalled()

    const config = plaidLinkMock.getConfig()
    await act(async () => {
      await config.onSuccess('public-token')
    })

    expect(plaidServiceMock.exchangeToken).toHaveBeenCalledWith('public-token')
    expect(plaidConnectionsMock.addConnection).toHaveBeenCalledWith('Test Bank', 'conn-1')
    expect(result.current.toast).toBe('Bank connected successfully!')
    expect(onError).toHaveBeenCalled()
    expect(onError.mock.calls.every(call => call[0] === null)).toBe(true)
  })

  it('provides syncOne, syncAll, and disconnect helpers', async () => {
    const onError = vi.fn()
    plaidConnectionsMock.connections = [
      {
        connectionId: 'bank-1',
        id: 'bank-1',
        institutionName: 'Bank One',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ]
    plaidConnectionsMock.getConnection.mockReturnValue(plaidConnectionsMock.connections[0])
    plaidServiceMock.syncTransactions.mockResolvedValue({
      transactions: [{ id: 't-1' }],
      metadata: {
        transaction_count: 1,
        account_count: 1,
        sync_timestamp: '2024-01-01T00:00:00Z',
      },
    } as any)
    plaidServiceMock.disconnect.mockResolvedValue({} as any)

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }))

    await act(async () => {
      await result.current.syncOne('bank-1')
    })

    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledWith('bank-1')
    expect(plaidConnectionsMock.updateConnectionSyncInfo).toHaveBeenCalledWith(
      'bank-1',
      1,
      1,
      '2024-01-01T00:00:00Z'
    )
    expect(result.current.toast).toContain('Synced 1 new transactions from Bank One')

    await act(async () => {
      await result.current.syncAll()
    })

    expect(result.current.syncingAll).toBe(false)
    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledTimes(2)

    await act(async () => {
      await result.current.disconnect('bank-1')
    })

    expect(plaidServiceMock.disconnect).toHaveBeenCalled()
    expect(plaidConnectionsMock.removeConnection).toHaveBeenCalledWith('bank-1')
    expect(result.current.toast).toBe('Bank One disconnected successfully')
    expect(onError).toHaveBeenCalled()
    expect(onError.mock.calls.every(call => call[0] === null)).toBe(true)
  })

  it('reports errors via onError', async () => {
    const onError = vi.fn()
    apiClientMock.post.mockRejectedValueOnce(new Error('bad request'))

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }))

    await act(async () => {
      await result.current.connect().catch(() => {})
    })

    expect(onError).toHaveBeenCalledWith('Failed to start bank connection: bad request')
    expect(result.current.error).toBe('Failed to start bank connection: bad request')
  })
})
