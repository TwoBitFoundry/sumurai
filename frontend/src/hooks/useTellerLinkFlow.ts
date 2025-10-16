import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProviderCatalog } from '../services/ProviderCatalog'
import { TellerService } from '../services/TellerService'
import type { PlaidConnection } from './usePlaidConnections'
import { useTellerConnect, type TellerEnvironment } from './useTellerConnect'
import { dispatchAccountsChanged } from '../utils/events'

export interface UseTellerLinkFlowOptions {
  applicationId: string | null
  environment?: TellerEnvironment
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

interface LoadResult {
  hasPopulatedBalances: boolean
  connectionIds: string[]
}

export function useTellerLinkFlow(options: UseTellerLinkFlowOptions): UseTellerLinkFlowResult {
  const { applicationId, environment = 'development', onError, enabled = true } = options

  const [connections, setConnections] = useState<PlaidConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const retryTimeoutRef = useRef<number | null>(null)
  const retryAttemptsRef = useRef(0)
  const hasTriggeredFollowupSyncRef = useRef(false)

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

  const loadConnections = useCallback(async (): Promise<LoadResult> => {
    if (!enabled) {
      return { hasPopulatedBalances: false, connectionIds: [] }
    }

    const resolveConnectionId = (account: any): string | null => {
      const raw =
        account.provider_connection_id ??
        account.connection_id ??
        account.plaid_connection_id ??
        account.providerConnectionId ??
        account.connectionId ??
        null

      return raw != null ? String(raw) : null
    }

    const parseNumeric = (value: unknown): number | undefined => {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return value
      }

      if (typeof value === 'string') {
        const trimmed = value.trim()
        const isNegativeParenthetical = trimmed.startsWith('(') && trimmed.endsWith(')')
        const stripped = trimmed.replace(/[^0-9.-]/g, '')
        if (stripped.length === 0) {
          return undefined
        }
        const parsed = Number(stripped)
        if (Number.isNaN(parsed)) {
          return undefined
        }
        return isNegativeParenthetical ? -parsed : parsed
      }

      return undefined
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
            .filter(account => resolveConnectionId(account) === status.connection_id)
            .map(account => {
              const ledger =
                parseNumeric(account.balance_ledger) ??
                parseNumeric(account.balance_current) ??
                parseNumeric((account as any).current_balance)

              const txnCount = parseNumeric(account.transaction_count)

              return {
                id: account.id,
                name: account.name,
                mask: account.mask ?? (account as any).last_four ?? '0000',
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
      dispatchAccountsChanged()
      const connectionIds = mapped.map(conn => conn.connectionId).filter(Boolean)
      const hasBalances = mapped.some(conn =>
        conn.accounts.some(acc => typeof acc.balance === 'number' && !Number.isNaN(acc.balance))
      )
      return { hasPopulatedBalances: hasBalances, connectionIds }
    } catch (err) {
      console.warn('Failed to load Teller connections', err)
      handleError('Failed to load Teller connections')
      setConnections([])
      return { hasPopulatedBalances: false, connectionIds: [] }
    } finally {
      setLoading(false)
    }
  }, [clearError, enabled, handleError])

  const loadConnectionsWithRetry = useCallback(async () => {
    const { hasPopulatedBalances, connectionIds } = await loadConnections()
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current)
    }
    if (!hasPopulatedBalances && connectionIds.length > 0 && !hasTriggeredFollowupSyncRef.current) {
      hasTriggeredFollowupSyncRef.current = true
      try {
        await Promise.all(connectionIds.map(id => TellerService.syncTransactions(id)))
      } catch (err) {
        console.warn('Follow-up Teller sync failed', err)
      }
    }
    if (hasPopulatedBalances || retryAttemptsRef.current >= 5) {
      retryAttemptsRef.current = 0
      hasTriggeredFollowupSyncRef.current = false
      retryTimeoutRef.current = null
      return
    }
    retryAttemptsRef.current += 1
    retryTimeoutRef.current = window.setTimeout(() => {
      retryTimeoutRef.current = null
      void loadConnectionsWithRetry()
    }, 1500)
  }, [loadConnections])

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [])

  const { ready, open } = useTellerConnect({
    applicationId: enabled ? (applicationId ?? '') : '',
    environment,
    onConnected: enabled ? loadConnectionsWithRetry : undefined
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
      const ids = connections
        .map(connection => connection.connectionId)
        .filter((id): id is string => Boolean(id))

      if (ids.length === 0) {
        setToast('No Teller connections to sync')
        return
      }

      await Promise.all(ids.map(id => TellerService.syncTransactions(id)))
      await loadConnections()
      setToast('Sync started for all Teller connections')
    } catch (err) {
      console.warn('Failed to sync Teller connections', err)
      handleError('Failed to sync Teller connections')
    } finally {
      setSyncingAll(false)
    }
  }, [clearError, connections, loadConnections, handleError])

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
