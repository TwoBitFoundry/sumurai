import { ApiClient } from './ApiClient'
import type { ProviderStatusResponse } from '../types/api'

export interface TellerConnectionStatus {
  connection_id: string
  institution_name: string
  last_sync_at: string | null
  transaction_count: number
  account_count: number
  is_connected: boolean
  sync_in_progress?: boolean
}

export class TellerService {
  static async getStatus(): Promise<TellerConnectionStatus[]> {
    const status = await ApiClient.get<ProviderStatusResponse>('/providers/status')

    if (status.provider !== 'teller') {
      return []
    }

    return status.connections.map(connection => ({
      connection_id: connection.connection_id ?? 'unknown',
      institution_name: connection.institution_name ?? 'Connected Bank',
      last_sync_at: connection.last_sync_at,
      transaction_count: connection.transaction_count,
      account_count: connection.account_count,
      is_connected: connection.is_connected,
      sync_in_progress: connection.sync_in_progress,
    }))
  }

  static async syncTransactions(connectionId?: string): Promise<void> {
    await ApiClient.post('/providers/sync-transactions', connectionId ? { connection_id: connectionId } : {})
  }

  static async disconnect(connectionId: string): Promise<void> {
    await ApiClient.post('/providers/disconnect', { connection_id: connectionId })
  }
}
