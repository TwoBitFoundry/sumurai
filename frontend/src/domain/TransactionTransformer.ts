import type { Transaction, TransactionCategory, TransactionLocation } from '../types/api';

export interface BackendTransaction {
  id: string;
  date: string;
  merchant_name?: string;
  normalized_merchant?: string;
  original_merchant_name?: string;
  normalization_source?: string;
  amount: number;
  category_primary?: string;
  category_detailed?: string;
  category_confidence?: string;
  is_custom?: boolean;
  is_overridden?: boolean;
  account_name: string;
  account_type: string;
  account_mask?: string;
  account_id?: string;
  running_balance?: number;
  location?: TransactionLocation;
}

export class TransactionTransformer {
  static backendToFrontend(bt: BackendTransaction): Transaction {
    const merchantName = bt.merchant_name ?? 'Unknown';
    const category: TransactionCategory = {
      primary: bt.category_primary ?? 'OTHER',
    };

    if (bt.category_detailed) {
      category.detailed = bt.category_detailed;
    }
    if (bt.category_confidence) {
      category.confidence_level = bt.category_confidence;
    }
    if (bt.is_custom != null) {
      category.is_custom = bt.is_custom;
    }
    if (bt.is_overridden != null) {
      category.is_overridden = bt.is_overridden;
    }

    return {
      id: bt.id,
      date: bt.date,
      name: merchantName,
      merchant: merchantName,
      originalMerchantName: bt.original_merchant_name,
      normalizationSource: bt.normalization_source,
      amount: bt.amount,
      category,
      account_name: bt.account_name,
      account_type: bt.account_type,
      account_mask: bt.account_mask,
      account_id: bt.account_id,
      running_balance: bt.running_balance,
      location: bt.location,
    };
  }
}
