import { ApiClient } from './ApiClient'
import type { Transaction } from '../types/api'
import { formatCategoryName } from '../utils/categories'
import { appendAccountQueryParams } from '../utils/queryParams'

export interface TransactionFilters {
  startDate?: string
  endDate?: string
  categoryId?: string
  searchTerm?: string
  search?: string
  dateRange?: string
  accountIds?: string[]
}

interface BackendTransaction {
  id: string
  date: string
  merchant_name?: string
  amount: number
  category_primary?: string
  account_name: string
  account_type: string
  account_mask?: string
}

export class TransactionService {
  static async getTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
    let endpoint = '/transactions'

    if (filters) {
      const params = new URLSearchParams()

      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.categoryId) params.append('categoryId', filters.categoryId)
      if (filters.searchTerm) params.append('searchTerm', filters.searchTerm)
      if (filters.search) params.append('search', filters.search)
      if (filters.dateRange) params.append('dateRange', filters.dateRange)
      appendAccountQueryParams(params, filters.accountIds)

      const queryString = params.toString()
      if (queryString) {
        endpoint += `?${queryString}`
      }
    }
    
    const backendTransactions = await ApiClient.get<BackendTransaction[]>(endpoint)
    
    if (!Array.isArray(backendTransactions)) {
      return []
    }
    
    return backendTransactions.map((bt): Transaction => ({
      id: bt.id,
      date: bt.date,
      name: bt.merchant_name || 'Unknown',
      merchant: bt.merchant_name,
      amount: bt.amount,
      category: {
        id: bt.category_primary || 'other',
        name: formatCategoryName(bt.category_primary)
      },
      account_name: bt.account_name,
      account_type: bt.account_type,
      account_mask: bt.account_mask
    }))
  }
}