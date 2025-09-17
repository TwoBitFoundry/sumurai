import { renderHook, act } from '@testing-library/react'
import { useOnboardingPlaidFlow } from '@/hooks/useOnboardingPlaidFlow'
import { vi } from 'vitest'

vi.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getLinkToken: vi.fn(),
    exchangeToken: vi.fn(),
    getStatus: vi.fn(),
  },
}))

vi.mock('react-plaid-link', () => ({
  usePlaidLink: vi.fn(),
}))

const mockPlaidService = vi.mocked(await import('@/services/PlaidService')).PlaidService
const mockUsePlaidLink = vi.mocked(await import('react-plaid-link')).usePlaidLink

describe('useOnboardingPlaidFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePlaidLink.mockReturnValue({
      open: vi.fn(),
      ready: true,
      error: null,
      exit: vi.fn(),
    })
  })

  it('given onboarding flow when initialized then starts with disconnected state', () => {
    const { result } = renderHook(() => useOnboardingPlaidFlow())

    expect(result.current.isConnected).toBe(false)
    expect(result.current.connectionInProgress).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('given onboarding flow when connect initiated then opens plaid link', async () => {
    const mockOpen = vi.fn()
    mockUsePlaidLink.mockReturnValue({
      open: mockOpen,
      ready: true,
      error: null,
      exit: vi.fn(),
    })
    mockPlaidService.getLinkToken.mockResolvedValue({ link_token: 'test-link-token' })

    const { result } = renderHook(() => useOnboardingPlaidFlow())

    await act(async () => {
      await result.current.initiateConnection()
    })

    expect(mockPlaidService.getLinkToken).toHaveBeenCalled()
    expect(mockOpen).toHaveBeenCalled()
  })

  it('given plaid connection when successful then marks step complete', async () => {
    const onConnectionSuccess = vi.fn()
    mockPlaidService.exchangeToken.mockResolvedValue({})
    mockPlaidService.getStatus.mockResolvedValue({
      connected: true,
      accounts_count: 1,
    })

    const { result } = renderHook(() =>
      useOnboardingPlaidFlow({ onConnectionSuccess })
    )

    await act(async () => {
      await result.current.handlePlaidSuccess('test-public-token')
    })

    expect(mockPlaidService.exchangeToken).toHaveBeenCalledWith('test-public-token')
    expect(result.current.isConnected).toBe(true)
    expect(result.current.institutionName).toBe('Connected Bank')
    expect(onConnectionSuccess).toHaveBeenCalledWith('Connected Bank')
  })

  it('given plaid connection when failed then shows error state', async () => {
    const onError = vi.fn()
    const mockError = new Error('Connection failed')
    mockPlaidService.exchangeToken.mockRejectedValue(mockError)

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
    mockPlaidService.getLinkToken.mockRejectedValue(mockError)

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
    const mockOpen = vi.fn()
    mockUsePlaidLink.mockReturnValue({
      open: mockOpen,
      ready: true,
      error: null,
      exit: vi.fn(),
    })
    mockPlaidService.getLinkToken.mockResolvedValue({ link_token: 'test-link-token' })

    const { result } = renderHook(() => useOnboardingPlaidFlow())

    act(() => {
      result.current.setError('Previous error')
    })

    await act(async () => {
      await result.current.retryConnection()
    })

    expect(result.current.error).toBe(null)
    expect(mockPlaidService.getLinkToken).toHaveBeenCalled()
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