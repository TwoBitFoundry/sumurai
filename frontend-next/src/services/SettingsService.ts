import { ApiClient } from './ApiClient'

interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

interface ChangePasswordResponse {
  message: string
  requires_reauth: boolean
}

interface DeletedItemsSummary {
  connections: number
  transactions: number
  accounts: number
  budgets: number
}

interface DeleteAccountResponse {
  message: string
  deleted_items: DeletedItemsSummary
}

export class SettingsService {
  static async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResponse> {
    return ApiClient.put<ChangePasswordResponse>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  }

  static async deleteAccount(): Promise<DeleteAccountResponse> {
    return ApiClient.delete<DeleteAccountResponse>('/auth/account')
  }
}

export type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  DeletedItemsSummary,
  DeleteAccountResponse,
}
