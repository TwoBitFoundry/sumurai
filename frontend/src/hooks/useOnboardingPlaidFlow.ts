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
  const [institutionName, setInstitutionName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setConnectionInProgress(false)
    onError?.(errorMessage)
  }, [onError])

  const handleSuccess = useCallback(async (publicToken: string) => {
    try {
      setConnectionInProgress(true)
      setError(null)

      await PlaidService.exchangeToken(publicToken)

      const status = await PlaidService.getStatus()

      if (status.connected) {
        setIsConnected(true)
        setInstitutionName('Connected Bank')
        onConnectionSuccess?.('Connected Bank')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      handleError(errorMessage)
    } finally {
      setConnectionInProgress(false)
    }
  }, [handleError, onConnectionSuccess])

  const { open } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: () => {
      setConnectionInProgress(false)
    },
    onEvent: () => {
    },
  })

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
      open()
    } catch (error) {
      setConnectionInProgress(false)
    }
  }, [getLinkToken, open])

  const retryConnection = useCallback(async () => {
    setError(null)
    await initiateConnection()
  }, [initiateConnection])

  const reset = useCallback(() => {
    setIsConnected(false)
    setConnectionInProgress(false)
    setInstitutionName(null)
    setError(null)
    setLinkToken(null)
  }, [])

  const handlePlaidSuccess = useCallback(async (publicToken: string) => {
    await handleSuccess(publicToken)
  }, [handleSuccess])

  return {
    isConnected,
    connectionInProgress,
    institutionName,
    error,
    initiateConnection,
    handlePlaidSuccess,
    retryConnection,
    reset,
    setError,
  }
}