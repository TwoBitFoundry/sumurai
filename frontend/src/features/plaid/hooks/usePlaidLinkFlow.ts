import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { ApiClient } from '../../../services/ApiClient'
import { PlaidService } from '../../../services/PlaidService'
import { usePlaidConnections, type PlaidConnection } from '../../../hooks/usePlaidConnections'

interface UsePlaidLinkFlowOptions {
  onError?: (message: string | null) => void
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
  const { onError } = options
  const plaidConnections = usePlaidConnections()
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  const handleError = useCallback((message: string) => {
    setError(message)
    onError?.(message)
  }, [onError])

  const clearError = useCallback(() => {
    setError(null)
    onError?.(null)
  }, [onError])

  const handleSuccess = useCallback(async (publicToken: string) => {
    try {
      clearError()
      const exchangeResult = await PlaidService.exchangeToken(publicToken)
      setToast('Bank connected successfully!')
      try {
        await plaidConnections.refresh()
      } catch {
        await plaidConnections.refresh()
      }
    } catch (e: any) {
      const message = `Failed to exchange token: ${e instanceof Error ? e.message : 'Unknown error'}`
      handleError(message)
    }
  }, [clearError, handleError, plaidConnections])

  const handleExit = useCallback((err: any) => {
    if (err) {
      handleError(`Plaid Link exited with error: ${err.error_message || 'Unknown error'}`)
    }
  }, [handleError])

  const { open, ready } = usePlaidLink({
    token: linkToken ?? undefined,
    onSuccess: handleSuccess,
    onExit: handleExit,
  })

  useEffect(() => {
    if (linkToken && ready && open) {
      open()
    }
  }, [linkToken, ready, open])

  const connect = useCallback(async () => {
    clearError()
    try {
      const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      const data = await ApiClient.post<{ link_token: string }>('/plaid/link-token', { user_id: userId })
      setLinkToken(data.link_token)
      if (ready) {
        open()
      }
    } catch (e: any) {
      const message = `Failed to start bank connection: ${e instanceof Error ? e.message : 'Unknown error'}`
      handleError(message)
      throw e
    }
  }, [clearError, handleError, open, ready])

  const syncOne = useCallback(async (connectionId: string) => {
    const connection = plaidConnections.getConnection(connectionId)
    if (!connection) return

    clearError()
    plaidConnections.setConnectionSyncInProgress(connectionId, true)
    try {
      const result = await PlaidService.syncTransactions(connectionId)
      const { transactions = [], metadata } = result || {}
      const count = Array.isArray(transactions) ? transactions.length : 0
      setToast(`Synced ${count} new transactions from ${connection.institutionName}`)

      await plaidConnections.refresh()
    } catch (e: any) {
      const message = `Sync failed for ${connection.institutionName}: ${e instanceof Error ? e.message : 'Unknown error'}`
      handleError(message)
      plaidConnections.setConnectionSyncInProgress(connectionId, false)
    }
  }, [clearError, handleError, plaidConnections])

  const syncAll = useCallback(async () => {
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
    const connection = plaidConnections.getConnection(connectionId)
    if (!connection) return

    clearError()
    try {
      await PlaidService.disconnect(connectionId)
      setToast(`${connection.institutionName} disconnected successfully`)
      await plaidConnections.refresh()
    } catch (e: any) {
      const message = `Failed to disconnect ${connection.institutionName}: ${e instanceof Error ? e.message : 'Unknown error'}`
      handleError(message)
    }
  }, [clearError, handleError, plaidConnections])

  const { connections, loading } = plaidConnections

  return useMemo(() => ({
    connections,
    loading,
    error,
    toast,
    setToast,
    connect,
    syncOne,
    syncAll,
    disconnect,
    syncingAll,
  }), [connections, loading, error, toast, connect, syncOne, syncAll, disconnect, syncingAll])
}
