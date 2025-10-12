import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { PlaidService } from '@/services/PlaidService'

export interface UseOnboardingPlaidFlowOptions {
  onConnectionSuccess?: (institutionName: string) => void
  onError?: (error: string) => void
}

export interface UseOnboardingPlaidFlowReturn {
  isConnected: boolean
  connectionInProgress: boolean
  isSyncing: boolean
  institutionName: string | null
  error: string | null
  initiateConnection: () => Promise<void>
  handlePlaidSuccess: (publicToken: string) => Promise<void>
  retryConnection: () => Promise<void>
  reset: () => void
  setError: (error: string | null) => void
}

export function useOnboardingPlaidFlow(
  options: UseOnboardingPlaidFlowOptions = {}
): UseOnboardingPlaidFlowReturn {
  const { onConnectionSuccess, onError } = options

  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionInProgress, setConnectionInProgress] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [institutionName, setInstitutionName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shouldOpenLink, setShouldOpenLink] = useState(false)

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setConnectionInProgress(false)
    onError?.(errorMessage)
  }, [onError])

  const handleSuccess = useCallback(async (publicToken: string) => {
    setConnectionInProgress(true)
    setError(null)

    try {
      await PlaidService.exchangeToken(publicToken)

      setIsConnected(true)
      setInstitutionName('Connected Bank')
      onConnectionSuccess?.('Connected Bank')

      let connectionId: string | null = null
      try {
        const status = await PlaidService.getStatus()
        const latestConnection = status.connections.find(conn => conn.is_connected) ?? status.connections[0]
        if (latestConnection) {
          setInstitutionName(latestConnection.institution_name || 'Connected Bank')
          connectionId = latestConnection.connection_id
        }
      } catch (statusError) {
        console.warn('Failed to refresh Plaid status after connection', statusError)
      }

      if (connectionId) {
        setIsSyncing(true)
        try {
          await PlaidService.syncTransactions(connectionId)
        } catch (syncError) {
          console.warn('Failed to sync transactions during onboarding', syncError)
        } finally {
          setIsSyncing(false)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      handleError(errorMessage)
    } finally {
      setConnectionInProgress(false)
    }
  }, [handleError, onConnectionSuccess])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: () => {
      setConnectionInProgress(false)
      setShouldOpenLink(false)
    },
    onEvent: () => {
    },
  })

  useEffect(() => {
    if (shouldOpenLink && ready) {
      open()
      setShouldOpenLink(false)
    }
  }, [shouldOpenLink, ready, open])

  const getLinkToken = useCallback(async () => {
    try {
      setError(null)
      const response = await PlaidService.getLinkToken()
      setLinkToken(response.link_token)
      return response.link_token
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get link token'
      handleError(errorMessage)
      throw error
    }
  }, [handleError])

  const initiateConnection = useCallback(async () => {
    try {
      setConnectionInProgress(true)
      await getLinkToken()
      setShouldOpenLink(true)
    } catch (error) {
      setConnectionInProgress(false)
      setShouldOpenLink(false)
    }
  }, [getLinkToken])

  const retryConnection = useCallback(async () => {
    setError(null)
    await initiateConnection()
  }, [initiateConnection])

  const reset = useCallback(() => {
    setIsConnected(false)
    setConnectionInProgress(false)
    setIsSyncing(false)
    setInstitutionName(null)
    setError(null)
    setLinkToken(null)
    setShouldOpenLink(false)
  }, [])

  const handlePlaidSuccess = useCallback(async (publicToken: string) => {
    await handleSuccess(publicToken)
  }, [handleSuccess])

  return {
    isConnected,
    connectionInProgress,
    isSyncing,
    institutionName,
    error,
    initiateConnection,
    handlePlaidSuccess,
    retryConnection,
    reset,
    setError,
  }
}
