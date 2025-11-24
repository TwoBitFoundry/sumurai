import { renderHook, act, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { useOnboardingPlaidFlow } from '@/hooks/useOnboardingPlaidFlow'
import { vi, afterEach } from 'vitest'
import { ApiClient } from '@/services/ApiClient'
import * as plaidLink from 'react-plaid-link'

let postSpy: jest.SpiedFunction<typeof ApiClient.post>
let getSpy: jest.SpiedFunction<typeof ApiClient.get>
let usePlaidLinkSpy: jest.SpiedFunction<typeof plaidLink.usePlaidLink>
let mockOpen: jest.Mock
describe('useOnboardingPlaidFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postSpy = jest.spyOn(ApiClient, 'post')
    getSpy = jest.spyOn(ApiClient, 'get')
    mockOpen = vi.fn()
    usePlaidLinkSpy = jest.spyOn(plaidLink, 'usePlaidLink').mockImplementation(({ token }) => {
      if (token) {
        mockOpen()
      }
      return {
        open: mockOpen,
        ready: true,
        error: null,
        exit: vi.fn(),
      }
    })
  })

  afterEach(() => {
    postSpy.mockRestore()
    getSpy.mockRestore()
    usePlaidLinkSpy?.mockRestore()
  })

  it('given onboarding flow when initialized then starts with disconnected state', () => {
    const { result } = renderHook(() => useOnboardingPlaidFlow())

    expect(result.current.isConnected).toBe(false)
    expect(result.current.connectionInProgress).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('given onboarding flow when connect initiated then opens plaid link', async () => {
    postSpy.mockResolvedValue({ link_token: 'test-link-token' } as any)

    const { result } = renderHook(() => useOnboardingPlaidFlow())

    await act(async () => {
      await result.current.initiateConnection()
    })
    await act(async () => {}) // flush effect
    await act(async () => {
      mockOpen()
    })

    expect(postSpy).toHaveBeenCalledWith('/plaid/link-token', {})
    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalled()
    })
  })

  it('given plaid connection when successful then marks step complete', async () => {
    const onConnectionSuccess = vi.fn()
    postSpy.mockResolvedValueOnce({} as any) // exchangeToken
    getSpy.mockResolvedValueOnce({
      connections: [{
        connection_id: 'conn-1',
        institution_name: 'Connected Bank',
        is_connected: true,
        accounts: [],
      }]
    })
    postSpy.mockResolvedValueOnce({ transactions: [], metadata: {} } as any)

    const { result } = renderHook(() =>
      useOnboardingPlaidFlow({ onConnectionSuccess })
    )

    await act(async () => {
      await result.current.handlePlaidSuccess('test-public-token')
    })

    expect(postSpy).toHaveBeenCalledWith('/plaid/exchange-token', { public_token: 'test-public-token' })
    expect(result.current.isConnected).toBe(true)
    expect(result.current.institutionName).toBe('Connected Bank')
    expect(onConnectionSuccess).toHaveBeenCalledWith('Connected Bank')
    expect(getSpy).toHaveBeenCalledWith('/providers/status')
  })

  it('given plaid status fetch fails after exchange then still marks connected', async () => {
    const onConnectionSuccess = vi.fn()
    postSpy.mockResolvedValueOnce({} as any) // exchangeToken
    getSpy.mockRejectedValue(new Error('status error'))

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() =>
      useOnboardingPlaidFlow({ onConnectionSuccess })
    )

    await act(async () => {
      await result.current.handlePlaidSuccess('test-public-token')
    })

    expect(result.current.isConnected).toBe(true)
    expect(onConnectionSuccess).toHaveBeenCalledWith('Connected Bank')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('given plaid connection when failed then shows error state', async () => {
    const onError = vi.fn()
    const mockError = new Error('Connection failed')
    postSpy.mockRejectedValue(mockError)

    const { result } = renderHook(() =>
      useOnboardingPlaidFlow({ onError })
    )

    await act(async () => {
      await result.current.handlePlaidSuccess('test-public-token')
    })

    expect(result.current.error).toBe('Connection failed')
    expect(result.current.isConnected).toBe(false)
    expect(onError).toHaveBeenCalledWith('Connection failed')
  })

  it('given link token request when fails then handles error gracefully', async () => {
    const onError = vi.fn()
    const mockError = new Error('Failed to get link token')
    postSpy.mockRejectedValue(mockError)

    const { result } = renderHook(() =>
      useOnboardingPlaidFlow({ onError })
    )

    await act(async () => {
      await result.current.initiateConnection()
    })

    expect(result.current.error).toBe('Failed to get link token')
    expect(onError).toHaveBeenCalledWith('Failed to get link token')
  })

  it('given connection error when retry called then clears error and retries', async () => {
    postSpy.mockResolvedValueOnce({ link_token: 'test-link-token' } as any)

    const { result } = renderHook(() => useOnboardingPlaidFlow())

    act(() => {
      result.current.setError('Previous error')
    })

    await act(async () => {
      await result.current.retryConnection()
    })

    expect(result.current.error).toBe(null)
    expect(postSpy).toHaveBeenCalledWith('/plaid/link-token', {})
  })

  it('given onboarding flow when reset then returns to initial state', () => {
    const { result } = renderHook(() => useOnboardingPlaidFlow())

    act(() => {
      result.current.setError('Test error')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.isConnected).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.connectionInProgress).toBe(false)
    expect(result.current.institutionName).toBe(null)
  })
})
