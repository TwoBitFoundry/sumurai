import { useState, useEffect, useCallback } from 'react'
import { ApiClient } from '../services/ApiClient'
import { PlaidService } from '../services/PlaidService'
import type { ProviderConnectionStatus } from '../types/api'

export interface PlaidConnectionState {
  isConnected: boolean
  lastSyncAt: string | null
  institutionName: string | null
  connectionId: string | null
  transactionCount: number
  accountCount: number
  syncInProgress: boolean
  loading: boolean
  error: string | null
}

export interface PlaidConnectionActions {
  markConnected: (institutionName: string, connectionId: string) => void
  disconnect: () => Promise<void>
  updateSyncInfo: (transactionCount: number, accountCount: number, lastSyncAt: string) => void
  refresh: () => Promise<void>
  setSyncInProgress: (inProgress: boolean) => void
}

export type UsePlaidConnectionReturn = PlaidConnectionState & PlaidConnectionActions

export const usePlaidConnection = (): UsePlaidConnectionReturn => {
  const [state, setState] = useState<PlaidConnectionState>({
    isConnected: false,
    lastSyncAt: null,
    institutionName: null,
    connectionId: null,
    transactionCount: 0,
    accountCount: 0,
    syncInProgress: false,
    loading: true,
    error: null
  })

  const fetchConnectionStatus = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const status = await PlaidService.getStatus()
      const connections: ProviderConnectionStatus[] = Array.isArray(status.connections)
        ? status.connections
        : []
      const active = connections.find(connection => connection.is_connected) ?? connections[0] ?? null

      setState(prev => ({
        ...prev,
        isConnected: active?.is_connected ?? false,
        lastSyncAt: active?.last_sync_at ?? null,
        institutionName: active?.institution_name ?? null,
        connectionId: active?.connection_id ?? null,
        transactionCount: active?.transaction_count ?? 0,
        accountCount: active?.account_count ?? 0,
        syncInProgress: active?.sync_in_progress ?? false,
        loading: false,
        error: null
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load connection status'
      }))
    }
  }, [])

  const markConnected = useCallback((institutionName: string, connectionId: string): void => {
    setState(prev => ({
      ...prev,
      isConnected: true,
      institutionName,
      connectionId,
      error: null
    }))
  }, [])

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      await ApiClient.post('/plaid/disconnect')

      setState(prev => ({
        ...prev,
        isConnected: false,
        lastSyncAt: null,
        institutionName: null,
        connectionId: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        error: null
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to disconnect Plaid integration'
      }))
    }
  }, [])

  const updateSyncInfo = useCallback((
    transactionCount: number, 
    accountCount: number, 
    lastSyncAt: string
  ): void => {
    setState(prev => ({
      ...prev,
      transactionCount,
      accountCount,
      lastSyncAt,
      syncInProgress: false
    }))
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    await fetchConnectionStatus()
  }, [fetchConnectionStatus])

  const setSyncInProgress = useCallback((inProgress: boolean): void => {
    setState(prev => ({
      ...prev,
      syncInProgress: inProgress
    }))
  }, [])

  useEffect(() => {
    fetchConnectionStatus()
  }, [fetchConnectionStatus])

  return {
    ...state,
    markConnected,
    disconnect,
    updateSyncInfo,
    refresh,
    setSyncInProgress
  }
}
