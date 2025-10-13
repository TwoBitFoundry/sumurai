import { useCallback, useEffect, useMemo, useState } from 'react'
import { TellerService } from '@/services/TellerService'
import { useTellerConnect, type TellerEnvironment } from './useTellerConnect'

export interface UseOnboardingTellerFlowOptions {
  applicationId: string | null
  environment?: TellerEnvironment
  enabled?: boolean
  onConnectionSuccess?: (institutionName: string) => void
  onError?: (error: string) => void
}

export interface UseOnboardingTellerFlowResult {
  isConnected: boolean
  connectionInProgress: boolean
  isSyncing: boolean
  institutionName: string | null
  error: string | null
  initiateConnection: () => Promise<void>
  retryConnection: () => Promise<void>
  reset: () => void
  setError: (value: string | null) => void
}

const DEFAULT_INSTITUTION_NAME = 'Connected Bank'

export function useOnboardingTellerFlow(
  options: UseOnboardingTellerFlowOptions
): UseOnboardingTellerFlowResult {
  const {
    applicationId,
    environment = 'development',
    enabled = true,
    onConnectionSuccess,
    onError,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [connectionInProgress, setConnectionInProgress] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [institutionName, setInstitutionName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((message: string) => {
    if (!enabled) {
      return
    }
    setError(message)
    onError?.(message)
  }, [enabled, onError])

  const refreshStatus = useCallback(async () => {
    if (!enabled) {
      return null
    }

    try {
      const statuses = await TellerService.getStatus()
      const latest = statuses.find(status => status.is_connected)

      if (latest) {
        const name = latest.institution_name || DEFAULT_INSTITUTION_NAME
        setIsConnected(true)
        setInstitutionName(name)
        onConnectionSuccess?.(name)
        return latest
      }
    } catch (statusError) {
      console.warn('Failed to load Teller connection status', statusError)
    }

    return null
  }, [enabled, onConnectionSuccess])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let isMounted = true
    const loadExistingConnection = async () => {
      try {
        const latest = await refreshStatus()
        if (!latest && isMounted) {
          setIsConnected(false)
          setInstitutionName(null)
        }
      } catch (err) {
        console.warn('Unable to load Teller onboarding status', err)
      }
    }

    void loadExistingConnection()

    return () => {
      isMounted = false
    }
  }, [enabled, refreshStatus])

  const { ready, open } = useTellerConnect({
    applicationId: enabled && applicationId ? applicationId : '',
    environment,
    onConnected: async () => {
      if (!enabled) {
        return
      }

      setIsSyncing(true)
      try {
        const latest = await refreshStatus()
        if (!latest) {
          handleError('Connected account not found. Please try again.')
          setIsConnected(false)
        } else {
          setError(null)
        }
      } finally {
        setIsSyncing(false)
        setConnectionInProgress(false)
      }
    },
    onExit: async () => {
      if (!enabled) {
        return
      }
      setConnectionInProgress(false)
    },
    onError: async (err) => {
      if (!enabled) {
        return
      }
      console.warn('Teller Connect error during onboarding', err)
      setConnectionInProgress(false)
      handleError('Failed to complete Teller connection. Please try again.')
    },
  })

  const initiateConnection = useCallback(async () => {
    if (!enabled) {
      return
    }

    setError(null)

    if (!applicationId) {
      handleError('Missing Teller application ID')
      return
    }

    if (!ready) {
      handleError('Teller Connect is still initializing. Please wait a moment.')
      return
    }

    try {
      setConnectionInProgress(true)
      open()
    } catch (err) {
      console.warn('Failed to open Teller Connect', err)
      setConnectionInProgress(false)
      handleError('Unable to start Teller Connect. Please try again.')
    }
  }, [applicationId, enabled, handleError, open, ready])

  const retryConnection = useCallback(async () => {
    if (!enabled) {
      return
    }
    await initiateConnection()
  }, [enabled, initiateConnection])

  const reset = useCallback(() => {
    if (!enabled) {
      return
    }
    setIsConnected(false)
    setConnectionInProgress(false)
    setIsSyncing(false)
    setInstitutionName(null)
    setError(null)
  }, [enabled])

  return useMemo(() => ({
    isConnected,
    connectionInProgress,
    isSyncing,
    institutionName,
    error,
    initiateConnection,
    retryConnection,
    reset,
    setError,
  }), [
    error,
    initiateConnection,
    isConnected,
    connectionInProgress,
    isSyncing,
    institutionName,
    retryConnection,
    reset,
    setError,
  ])
}
