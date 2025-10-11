import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProviderCatalog } from '../services/ProviderCatalog'
import { TellerService } from '../services/TellerService'
import type { PlaidConnection } from './usePlaidConnections'
import { useTellerConnect } from './useTellerConnect'

export interface UseTellerLinkFlowOptions {
  applicationId: string | null
  onError?: (message: string | null) => void
  enabled?: boolean
}

export interface UseTellerLinkFlowResult {
  connections: PlaidConnection[]
  loading: boolean
  error: string | null
  toast: string | null
  setToast: (value: string | null) => void
  connect: () => Promise<void>
  syncOne: (connectionId: string) => Promise<void>
  syncAll: () => Promise<void>
  disconnect: (connectionId: string) => Promise<void>
  syncingAll: boolean
}

export function useTellerLinkFlow(options: UseTellerLinkFlowOptions): UseTellerLinkFlowResult {
  const { applicationId, onError, enabled = true } = options

  const [connections, setConnections] = useState<PlaidConnection[]>([])
  const [loading, setLoading] = useState(false)
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

  const loadConnections = useCallback(async () => {
    if (!enabled) {
      return
    }

    setLoading(true)
    clearError()
    try {
      const [statusList, accounts] = await Promise.all([
        TellerService.getStatus(),
        ProviderCatalog.getAccounts()
      ])

      const mapAccountType = (value: string | null | undefined): PlaidConnection['accounts'][number]['type'] => {
        const normalized = (value ?? '').toLowerCase()
        if (normalized.includes('savings')) return 'savings'
        if (normalized.includes('credit')) return 'credit'
        if (normalized.includes('loan')) return 'loan'
        if (normalized.includes('depository') || normalized.includes('checking')) return 'checking'
        return 'other'
      }

      const mapped: PlaidConnection[] = statusList
        .filter(status => status.is_connected)
        .map(status => {
          const connectionAccounts = accounts
            .filter(account => (account.connection_id || (account as any).plaid_connection_id) === status.connection_id)
            .map(account => {
              const ledger =
                typeof account.balance_ledger === 'number'
                  ? account.balance_ledger
                  : typeof (account as any).balance_current === 'number'
                    ? (account as any).balance_current
                    : undefined

              const txnCount =
                typeof (account as any).transaction_count === 'number'
                  ? (account as any).transaction_count
                  : undefined

              return {
                id: account.id,
                name: account.name,
                mask: account.mask ?? '0000',
                type: mapAccountType(account.account_type),
                balance: ledger,
                transactions: txnCount,
              }
            })

          return {
            id: status.connection_id,
            connectionId: status.connection_id,
            institutionName: status.institution_name || 'Unknown Bank',
            lastSyncAt: status.last_sync_at,
            transactionCount: status.transaction_count,
            accountCount: status.account_count,
            syncInProgress: status.sync_in_progress ?? false,
            isConnected: status.is_connected,
            accounts: connectionAccounts
          }
        })

      setConnections(mapped)
    } catch (err) {
      console.warn('Failed to load Teller connections', err)
      handleError('Failed to load Teller connections')
      setConnections([])
    } finally {
      setLoading(false)
    }
  }, [clearError, enabled, handleError])

  const { ready, open } = useTellerConnect({
    applicationId: enabled ? (applicationId ?? '') : '',
    onConnected: enabled ? loadConnections : undefined
  })

  useEffect(() => {
    if (!enabled) {
      setConnections([])
      clearError()
      return
    }
    if (!applicationId) {
      handleError('Missing Teller application ID')
      return
    }
    loadConnections()
  }, [applicationId, enabled, loadConnections, handleError])

  const connect = useCallback(async () => {
    clearError()
    if (!enabled) {
      return
    }

    if (!applicationId) {
      handleError('Missing Teller application ID')
      return
    }
    if (!ready) {
      handleError('Teller Connect is not ready yet')
      return
    }

    open()
  }, [applicationId, clearError, handleError, loadConnections, open, ready])

  const syncOne = useCallback(async (connectionId: string) => {
    if (!enabled) {
      return
    }

    clearError()
    try {
      await TellerService.syncTransactions(connectionId)
      await loadConnections()
      setToast('Sync started for Teller connection')
    } catch (err) {
      console.warn('Failed to sync Teller connection', err)
      handleError('Failed to sync Teller connection')
    }
  }, [clearError, loadConnections, handleError])

  const syncAll = useCallback(async () => {
    if (!enabled) {
      return
    }

    clearError()
    setSyncingAll(true)
    try {
      await TellerService.syncTransactions()
      await loadConnections()
      setToast('Sync started for all Teller connections')
    } catch (err) {
      console.warn('Failed to sync Teller connections', err)
      handleError('Failed to sync Teller connections')
    } finally {
      setSyncingAll(false)
    }
  }, [clearError, loadConnections, handleError])

  const disconnect = useCallback(async (connectionId: string) => {
    if (!enabled) {
      return
    }

    clearError()
    try {
      await TellerService.disconnect(connectionId)
      await loadConnections()
      setToast('Disconnected Teller connection')
    } catch (err) {
      console.warn('Failed to disconnect Teller connection', err)
      handleError('Failed to disconnect Teller connection')
    }
  }, [clearError, loadConnections, handleError])

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
    syncingAll
  }), [connections, loading, error, toast, connect, syncOne, syncAll, disconnect, syncingAll])
}
