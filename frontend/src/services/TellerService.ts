import { ApiClient } from './ApiClient'

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
    return ApiClient.get<TellerConnectionStatus[]>('/teller/status')
  }

  static async syncTransactions(connectionId?: string): Promise<void> {
    await ApiClient.post('/teller/sync-transactions', connectionId ? { connection_id: connectionId } : {})
  }

  static async disconnect(connectionId: string): Promise<void> {
    await ApiClient.post('/teller/disconnect', { connection_id: connectionId })
  }
}

