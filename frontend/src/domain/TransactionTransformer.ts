import type { Transaction, TransactionCategory, TransactionLocation } from '../types/api'

export interface BackendTransaction {
  id: string
  date: string
  merchant_name?: string
  amount: number
  category_primary?: string
  category_detailed?: string
  category_confidence?: string
  account_name: string
  account_type: string
  account_mask?: string
  running_balance?: number
  location?: TransactionLocation
}

export class TransactionTransformer {
  static backendToFrontend(bt: BackendTransaction): Transaction {
    const category: TransactionCategory = {
      primary: bt.category_primary ?? 'OTHER'
    }

    if (bt.category_detailed) {
      category.detailed = bt.category_detailed
    }
    if (bt.category_confidence) {
      category.confidence_level = bt.category_confidence
    }

    return {
      id: bt.id,
      date: bt.date,
      name: bt.merchant_name || 'Unknown',
      merchant: bt.merchant_name,
      amount: bt.amount,
      category,
      account_name: bt.account_name,
      account_type: bt.account_type,
      account_mask: bt.account_mask,
      running_balance: bt.running_balance,
      location: bt.location
    }
  }
}
