import { useState, useEffect, useCallback } from 'react'
import { ApiClient } from '../services/ApiClient'
import { PlaidService } from '../services/PlaidService'

const mapAccountType = (backendType: string): 'checking' | 'savings' | 'credit' | 'loan' | 'other' => {
  switch (backendType.toLowerCase()) {
    case 'depository':
    case 'checking':
      return 'checking'
    case 'savings':
      return 'savings'
    case 'credit':
    case 'credit card':
      return 'credit'
    case 'loan':
      return 'loan'
    default:
      return 'other'
  }
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

export const usePlaidConnections = (): UsePlaidConnectionsReturn => {
  const [state, setState] = useState<PlaidConnectionsState>({
    connections: [],
    loading: true,
    error: null
  })

  const fetchConnections = useCallback(async (): Promise<PlaidConnection[]> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      // Fetch all connections for this user
      const data = await ApiClient.get<any>('/plaid/status')
      
      let accounts: Array<{
        id: string
        name: string
        mask: string
        type: 'checking' | 'savings' | 'credit' | 'loan' | 'other'
        balance?: number
        transactions?: number
      }> = []
      // If connected, fetch accounts
      if (data.is_connected) {
        try {
          const backendAccounts = await PlaidService.getAccounts()
          accounts = backendAccounts.map((account: any) => ({
            id: account.id,
            name: account.name,
            mask: account.mask || '0000',
            type: mapAccountType(account.account_type),
            balance: account.balance_current ? parseFloat(account.balance_current) : undefined,
            transactions: account.transaction_count || 0
          }))
        } catch (accountError) {
          console.warn('Failed to fetch accounts:', accountError)
          // Don't fail the whole connection load if accounts fail
        }
      }
      
      // Transform single connection response to array format
      // TODO: Update backend to return array of connections
      const connections: PlaidConnection[] = data.is_connected ? [{
        id: data.connection_id || 'legacy',
        connectionId: data.connection_id || 'legacy',
        institutionName: data.institution_name || 'Connected Bank',
        lastSyncAt: data.last_sync_at,
        transactionCount: data.transaction_count || 0,
        accountCount: data.account_count || 0,
        syncInProgress: data.sync_in_progress || false,
        isConnected: true,
        accounts: accounts
      }] : []

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
  }, [])

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
      accounts = backendAccounts.map((account: any) => ({
        id: account.id,
        name: account.name,
        mask: account.mask || '0000',
        type: mapAccountType(account.account_type),
        balance: account.balance_current ? parseFloat(account.balance_current) : undefined,
        transactions: account.transaction_count || 0
      }))
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
