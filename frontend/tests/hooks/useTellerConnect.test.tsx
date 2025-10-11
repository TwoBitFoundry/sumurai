import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { TellerConnectGateway } from '@/hooks/useTellerConnect'
import { useTellerConnect } from '@/hooks/useTellerConnect'

describe('useTellerConnect', () => {
  const setup = vi.fn()
  const open = vi.fn()
  const destroy = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    setup.mockReturnValue({ open, destroy })
    Object.assign(globalThis, {
      TellerConnect: {
        setup
      }
    })
  })

  afterEach(() => {
    cleanup()
    // @ts-ignore
    delete globalThis.TellerConnect
  })

  const createGateway = (): TellerConnectGateway => ({
    storeEnrollment: vi.fn().mockResolvedValue(undefined),
    syncTransactions: vi.fn().mockResolvedValue(undefined)
  })

  it('initializes Teller Connect and exposes open callback', async () => {
    const gateway = createGateway()
    const { result, unmount } = renderHook(() =>
      useTellerConnect({ applicationId: 'app-123', gateway })
    )

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(setup).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-123'
      })
    )

    act(() => {
      result.current.open()
    })

    expect(open).toHaveBeenCalledTimes(1)
    unmount()
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('stores enrollment and triggers sync on success', async () => {
    const gateway = createGateway()
    renderHook(() =>
      useTellerConnect({ applicationId: 'app-123', gateway })
    )

    await waitFor(() => expect(setup).toHaveBeenCalled())

    const config = setup.mock.calls[0][0]
    await config.onSuccess({
      accessToken: 'access-token',
      user: { id: 'user-1' },
      enrollment: {
        id: 'enroll-1',
        institution: {
          name: 'Sample Bank'
        }
      }
    })

    expect(gateway.storeEnrollment).toHaveBeenCalledWith({
      access_token: 'access-token',
      enrollment_id: 'enroll-1',
      institution_name: 'Sample Bank'
    })
    expect(gateway.syncTransactions).toHaveBeenCalledTimes(1)
  })
})

