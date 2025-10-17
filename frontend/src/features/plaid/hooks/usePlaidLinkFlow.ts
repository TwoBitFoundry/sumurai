import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { ApiClient } from '../../../services/ApiClient'
import { PlaidService } from '../../../services/PlaidService'
import { usePlaidConnections, type PlaidConnection } from '../../../hooks/usePlaidConnections'
import { dispatchAccountsChanged } from '../../../utils/events'

interface UsePlaidLinkFlowOptions {
  onError?: (message: string | null) => void
  enabled?: boolean
}

export interface UsePlaidLinkFlowResult {
  connections: PlaidConnection[]
  loading: boolean
  error: string | null
  toast: string | null
  setToast: (next: string | null) => void
  connect: () => Promise<void>
  syncOne: (connectionId: string) => Promise<void>
  syncAll: () => Promise<void>
  disconnect: (connectionId: string) => Promise<void>
  syncingAll: boolean
}

export function usePlaidLinkFlow(options: UsePlaidLinkFlowOptions = {}): UsePlaidLinkFlowResult {
  const { onError, enabled = true } = options
  const plaidConnections = usePlaidConnections({ enabled })
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  const handleError = useCallback((message: string) => {
    if (enabled) {
      setError(message)
      onError?.(message)
    }
  }, [enabled, onError])

  const clearError = useCallback(() => {
    if (enabled) {
      setError(null)
      onError?.(null)
    }
  }, [enabled, onError])

  const handleSuccess = useCallback(async (publicToken: string) => {
    if (!enabled) return

    try {
      clearError()
      await PlaidService.exchangeToken(publicToken)

      const updatedConnections = await plaidConnections.refresh()

      if (updatedConnections.length > 0) {
        const latestConnection = updatedConnections[0]
        try {
          const result = await PlaidService.syncTransactions(latestConnection.connectionId)
          const { transactions = [] } = result || {}
          const count = Array.isArray(transactions) ? transactions.length : 0
          setToast(`Bank connected! Synced ${count} transactions`)
          await plaidConnections.refresh()
          dispatchAccountsChanged()
        } catch (syncError: unknown) {
          console.warn('Failed to sync transactions after connection', syncError)
          setToast(`Bank connected to ${latestConnection.institutionName}`)
          dispatchAccountsChanged()
        }
      } else {
        setToast('Bank connected successfully!')
        dispatchAccountsChanged()
      }
    } catch (error: unknown) {
      const message = `Failed to exchange token: ${error instanceof Error ? error.message : 'Unknown error'}`
      handleError(message)
    }
  }, [clearError, handleError, plaidConnections])

  const handleExit = useCallback((err: unknown) => {
    if (!enabled) return
    if (err && typeof err === 'object' && 'error_message' in err) {
      const message = (err as { error_message?: string }).error_message || 'Unknown error'
      handleError(`Plaid Link exited with error: ${message}`)
    } else if (err) {
      handleError('Plaid Link exited with an unknown error')
    }
  }, [enabled, handleError])

  const { open, ready } = usePlaidLink({
    token: enabled && linkToken ? linkToken : undefined,
    onSuccess: handleSuccess,
    onExit: handleExit,
  })

  useEffect(() => {
    if (!enabled) return
    if (linkToken && ready && open) {
      open()
    }
  }, [enabled, linkToken, ready, open])

  const connect = useCallback(async () => {
    if (!enabled) return
    clearError()
    try {
      const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      const data = await ApiClient.post<{ link_token: string }>('/plaid/link-token', { user_id: userId })
      setLinkToken(data.link_token)
      if (ready) {
        open()
      }
    } catch (error: unknown) {
      const message = `Failed to start bank connection: ${error instanceof Error ? error.message : 'Unknown error'}`
      handleError(message)
      throw error
    }
  }, [clearError, handleError, open, ready])

  const syncOne = useCallback(async (connectionId: string) => {
    if (!enabled) return
    const connection = plaidConnections.getConnection(connectionId)
    if (!connection) return

    clearError()
    plaidConnections.setConnectionSyncInProgress(connectionId, true)
    try {
      const result = await PlaidService.syncTransactions(connectionId)
      const { transactions = [] } = result || {}
      const count = Array.isArray(transactions) ? transactions.length : 0
      setToast(`Synced ${count} new transactions from ${connection.institutionName}`)

      await plaidConnections.refresh()
    } catch (error: unknown) {
      const message = `Sync failed for ${connection.institutionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      handleError(message)
      plaidConnections.setConnectionSyncInProgress(connectionId, false)
    }
  }, [clearError, handleError, plaidConnections])

  const syncAll = useCallback(async () => {
    if (!enabled) return
    clearError()
    setSyncingAll(true)
    try {
      const tasks = plaidConnections.connections.map(conn => syncOne(conn.connectionId))
      await Promise.all(tasks)
      await plaidConnections.refresh()
    } finally {
      setSyncingAll(false)
    }
  }, [clearError, plaidConnections, syncOne])

  const disconnect = useCallback(async (connectionId: string) => {
    if (!enabled) return
    const connection = plaidConnections.getConnection(connectionId)
    if (!connection) return

    clearError()
    try {
      await PlaidService.disconnect(connectionId)
      setToast(`${connection.institutionName} disconnected successfully`)
      await plaidConnections.refresh()
      dispatchAccountsChanged()
    } catch (error: unknown) {
      const message = `Failed to disconnect ${connection.institutionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      handleError(message)
    }
  }, [clearError, handleError, plaidConnections])

  const { connections, loading } = plaidConnections
  const resolvedConnections = enabled ? connections : []
  const resolvedLoading = enabled ? loading : false
  const resolvedError = enabled ? error : null
  const resolvedSyncingAll = enabled ? syncingAll : false

  return useMemo(() => ({
    connections: resolvedConnections,
    loading: resolvedLoading,
    error: resolvedError,
    toast,
    setToast,
    connect,
    syncOne,
    syncAll,
    disconnect,
    syncingAll: resolvedSyncingAll,
  }), [resolvedConnections, resolvedLoading, resolvedError, toast, connect, syncOne, syncAll, disconnect, resolvedSyncingAll])
}
