import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ProviderGateway } from '@/hooks/useProviderInfo'
import { useProviderInfo } from '@/hooks/useProviderInfo'

describe('useProviderInfo', () => {
  const createGateway = (): ProviderGateway => ({
    fetchInfo: vi.fn().mockResolvedValue({
      available_providers: ['plaid', 'teller'],
      default_provider: 'plaid',
      user_provider: undefined
    }),
    selectProvider: vi.fn().mockResolvedValue({
      user_provider: 'teller'
    })
  })

  it('loads provider catalogue on mount', async () => {
    const gateway = createGateway()
    const { result } = renderHook(() => useProviderInfo({ gateway }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.availableProviders).toEqual(['plaid', 'teller'])
    expect(result.current.selectedProvider).toBe('plaid')
    expect(gateway.fetchInfo).toHaveBeenCalledTimes(1)
  })

  it('selects provider through gateway', async () => {
    const gateway = createGateway()
    const { result } = renderHook(() => useProviderInfo({ gateway }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.chooseProvider('teller')
    })

    expect(gateway.selectProvider).toHaveBeenCalledWith('teller')
    expect(result.current.selectedProvider).toBe('teller')
  })
})

