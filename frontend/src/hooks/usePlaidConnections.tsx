import { useState, useEffect, useCallback } from 'react'
import { PlaidService } from '../services/PlaidService'
import { AccountNormalizer } from '../domain/AccountNormalizer'

type NormalizedAccount = {
  id: string
  name: string
  mask: string
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'other'
  balance?: number
  transactions?: number
  connectionKey: string | null
}

export interface PlaidConnection {
  id: string
  connectionId: string
  institutionName: string
  lastSyncAt: string | null
  transactionCount: number
  accountCount: number
  syncInProgress: boolean
  isConnected: boolean
  accounts: Array<{
    id: string
    name: string
    mask: string
    type: 'checking' | 'savings' | 'credit' | 'loan' | 'other'
    balance?: number
    transactions?: number
  }>
}

export interface PlaidConnectionsState {
  connections: PlaidConnection[]
  loading: boolean
  error: string | null
}

export interface PlaidConnectionsActions {
  addConnection: (institutionName: string, connectionId: string) => Promise<void>
  removeConnection: (connectionId: string) => void
  updateConnectionSyncInfo: (connectionId: string, transactionCount: number, accountCount: number, lastSyncAt: string) => void
  setConnectionSyncInProgress: (connectionId: string, inProgress: boolean) => void
  refresh: () => Promise<PlaidConnection[]>
  getConnection: (connectionId: string) => PlaidConnection | undefined
}

export type UsePlaidConnectionsReturn = PlaidConnectionsState & PlaidConnectionsActions

export const usePlaidConnections = (options: { enabled?: boolean } = {}): UsePlaidConnectionsReturn => {
  const enabled = options.enabled ?? true
  const [state, setState] = useState<PlaidConnectionsState>({
    connections: [],
    loading: true,
    error: null
  })

  const normalizeAccounts = (backendAccounts: any[]): NormalizedAccount[] => {
    return AccountNormalizer.normalize(backendAccounts)
  }

  const fetchConnections = useCallback(async (): Promise<PlaidConnection[]> => {
    if (!enabled) {
      setState(prev => ({ ...prev, connections: [], loading: false, error: null }))
      return []
    }
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      // Fetch all connections for this user (backend now returns array)
      const status = await PlaidService.getStatus()
      const statusArray = Array.isArray(status.connections) ? status.connections : []

      // Fetch accounts once for all connections
      let allAccounts: NormalizedAccount[] = []

      if (Array.isArray(statusArray) && statusArray.length > 0) {
        try {
          const backendAccounts = await PlaidService.getAccounts()
          allAccounts = normalizeAccounts(backendAccounts)
        } catch (accountError) {
          console.warn('Failed to fetch accounts:', accountError)
        }
      }

      // Map backend status array to PlaidConnection objects, filtering out disconnected ones
      const connections: PlaidConnection[] =
        statusArray.length > 0
          ? statusArray
              .filter((connStatus: any) => connStatus.is_connected)
              .map((connStatus: any) => {
                const connectionId = connStatus.connection_id ? String(connStatus.connection_id) : null
                let matchingAccounts: NormalizedAccount[]

                if (connectionId) {
                  matchingAccounts = allAccounts.filter(acc => acc.connectionKey === connectionId)
                  if (matchingAccounts.length === 0) {
                    matchingAccounts = allAccounts.filter(acc => acc.connectionKey === null)
                  }
                } else {
                  matchingAccounts = allAccounts.slice()
                }

                const connectionAccounts = matchingAccounts.map(({ connectionKey: _ignore, ...rest }) => rest)
                return {
                  id: connStatus.connection_id || 'unknown',
                  connectionId: connStatus.connection_id || 'unknown',
                  institutionName: connStatus.institution_name || 'Unknown Bank',
                  lastSyncAt: connStatus.last_sync_at,
                  transactionCount: connStatus.transaction_count || 0,
                  accountCount: connStatus.account_count || 0,
                  syncInProgress: connStatus.sync_in_progress || false,
                  isConnected: connStatus.is_connected,
                  accounts: connectionAccounts
                }
              })
          : []

      setState(prev => ({
        ...prev,
        connections,
        loading: false,
        error: null
      }))
      return connections
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load connections'
      }))
      return []
    }
  }, [enabled])

  const addConnection = useCallback(async (institutionName: string, connectionId: string): Promise<void> => {
    let accounts: Array<{
      id: string
      name: string
      mask: string
      type: 'checking' | 'savings' | 'credit' | 'loan' | 'other'
      balance?: number
      transactions?: number
    }> = []
    // Try to fetch accounts for the new connection
    try {
      const backendAccounts = await PlaidService.getAccounts()
      const normalized = normalizeAccounts(backendAccounts)
      const connectionKey = connectionId ? String(connectionId) : null

      let matching = connectionKey
        ? normalized.filter(acc => acc.connectionKey === connectionKey)
        : normalized.slice()

      if (connectionKey && matching.length === 0) {
        matching = normalized.filter(acc => acc.connectionKey === null)
      }

      accounts = matching.map(({ connectionKey: _ignore, ...rest }) => rest)
    } catch (accountError) {
      console.warn('Failed to fetch accounts for new connection:', accountError)
    }

    const newConnection: PlaidConnection = {
      id: connectionId,
      connectionId,
      institutionName,
      lastSyncAt: null,
      transactionCount: 0,
      accountCount: 0,
      syncInProgress: false,
      isConnected: true,
      accounts: accounts
    }

    setState(prev => ({
      ...prev,
      connections: [...prev.connections, newConnection],
      error: null
    }))
  }, [])

  const removeConnection = useCallback((connectionId: string): void => {
    setState(prev => ({
      ...prev,
      connections: prev.connections.filter(conn => conn.connectionId !== connectionId)
    }))
  }, [])

  const updateConnectionSyncInfo = useCallback((
    connectionId: string,
    transactionCount: number,
    accountCount: number,
    lastSyncAt: string
  ): void => {
    setState(prev => ({
      ...prev,
      connections: prev.connections.map(conn =>
        conn.connectionId === connectionId
          ? {
              ...conn,
              transactionCount,
              accountCount,
              lastSyncAt,
              syncInProgress: false
            }
          : conn
      )
    }))
  }, [])

  const setConnectionSyncInProgress = useCallback((connectionId: string, inProgress: boolean): void => {
    setState(prev => ({
      ...prev,
      connections: prev.connections.map(conn =>
        conn.connectionId === connectionId
          ? { ...conn, syncInProgress: inProgress }
          : conn
      )
    }))
  }, [])

  const refresh = useCallback(async (): Promise<PlaidConnection[]> => {
    return await fetchConnections()
  }, [fetchConnections])

  const getConnection = useCallback((connectionId: string): PlaidConnection | undefined => {
    return state.connections.find(conn => conn.connectionId === connectionId)
  }, [state.connections])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  return {
    ...state,
    addConnection,
    removeConnection,
    updateConnectionSyncInfo,
    setConnectionSyncInProgress,
    refresh,
    getConnection
  }
}
