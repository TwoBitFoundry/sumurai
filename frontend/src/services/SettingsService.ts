/**
 * API access for user and application settings.
 */

import { ApiClient } from './ApiClient';

interface DeletedItemsSummary {
  connections: number;
  transactions: number;
  accounts: number;
  budgets: number;
}

interface DeleteAccountResponse {
  message: string;
  deleted_items: DeletedItemsSummary;
}

export class SettingsService {
  static async deleteAccount(): Promise<DeleteAccountResponse> {
    return ApiClient.delete<DeleteAccountResponse>('/auth/account');
  }
}

export type { DeleteAccountResponse, DeletedItemsSummary };
