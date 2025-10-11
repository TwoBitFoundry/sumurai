import { useCallback, useEffect, useState } from 'react'
import { ApiClient } from '../services/ApiClient'

type TellerEnvironment = 'sandbox' | 'development' | 'production'

declare global {
  interface Window {
    TellerConnect?: {
      setup: (config: TellerConnectConfig) => TellerInstance
    }
  }
}

interface TellerConnectConfig {
  applicationId: string
  onSuccess: (enrollment: TellerEnrollment) => Promise<void> | void
  onExit?: () => void
  environment?: TellerEnvironment
  selectAccount?: 'single' | 'multiple'
}

interface TellerEnrollment {
  accessToken: string
  user: { id: string }
  enrollment: { id: string; institution: { name: string } }
}

interface TellerInstance {
  open: () => void
  destroy: () => void
}

interface StoreEnrollmentRequest {
  access_token: string
  enrollment_id: string
  institution_name: string
}

export interface TellerConnectGateway {
  storeEnrollment: (payload: StoreEnrollmentRequest) => Promise<void>
  syncTransactions: () => Promise<void>
}

const apiGateway: TellerConnectGateway = {
  async storeEnrollment(payload) {
    await ApiClient.post('/teller/connect', payload)
  },
  async syncTransactions() {
    await ApiClient.post('/teller/sync-transactions')
  }
}

export interface UseTellerConnectOptions {
  applicationId: string
  environment?: TellerEnvironment
  gateway?: TellerConnectGateway
  onConnected?: () => Promise<void> | void
}

export interface UseTellerConnectResult {
  ready: boolean
  open: () => void
}

export function useTellerConnect(options: UseTellerConnectOptions): UseTellerConnectResult {
  const { applicationId, environment = 'development', gateway = apiGateway, onConnected } = options
  const [instance, setInstance] = useState<TellerInstance | null>(null)

  useEffect(() => {
    if (!applicationId) {
      return
    }

    if (!window.TellerConnect) {
      console.warn('TellerConnect script not loaded')
      return
    }

    const tellerInstance = window.TellerConnect.setup({
      applicationId,
      environment,
      selectAccount: 'multiple',
      onSuccess: async (enrollment) => {
        try {
          await gateway.storeEnrollment({
            access_token: enrollment.accessToken,
            enrollment_id: enrollment.enrollment.id,
            institution_name: enrollment.enrollment.institution.name
          })
          await gateway.syncTransactions()
          await onConnected?.()
        } catch (err) {
          console.warn('Failed to persist Teller enrollment', err)
          throw err
        }
      },
      onExit: () => {
        // noop hook for now
      }
    })

    setInstance(tellerInstance)

    return () => {
      tellerInstance.destroy()
      setInstance(null)
    }
  }, [applicationId, environment, gateway])

  const open = useCallback(() => {
    instance?.open()
  }, [instance])

  return {
    ready: Boolean(instance),
    open
  }
}
