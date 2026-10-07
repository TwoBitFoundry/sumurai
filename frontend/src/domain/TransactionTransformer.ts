import type {
  FinancialProvider,
  Transaction,
  TransactionCategory,
  TransactionLocation,
} from '../types/api';

export interface BackendTransaction {
  id: string;
  account_id?: string;
  date: string;
  merchant_name?: string;
  amount: number;
  pending?: boolean;
  category_primary?: string;
  category_detailed?: string;
  category_confidence?: string;
  account_name: string;
  account_type: string;
  account_mask?: string;
  provider?: FinancialProvider;
  running_balance?: number;
  location?: TransactionLocation;
  custom_category?: string;
  custom_subcategory?: string;
  rule_category?: string;
  rule_subcategory?: string;
}

export class TransactionTransformer {
  static backendToFrontend(bt: BackendTransaction): Transaction {
    const primary = bt.custom_category ?? bt.rule_category ?? bt.category_primary ?? 'OTHER';

    // Priority: custom override subcategory > rule subcategory > provider detailed (only if no category override)
    let detailed: string | undefined;
    if (bt.custom_category || bt.rule_category) {
      detailed = bt.custom_subcategory ?? bt.rule_subcategory;
    } else {
      detailed = bt.custom_subcategory ?? bt.rule_subcategory ?? bt.category_detailed;
    }

    const category: TransactionCategory = {
      // Priority: explicit override > rule match > provider category
      primary,
    };

    if (
      detailed &&
      detailed.trim().toLowerCase() !== 'other' &&
      !detailed.trim().toLowerCase().startsWith('other ') &&
      (primary.trim().toLowerCase() === 'groceries'
        ? true
        : detailed.trim().toLowerCase() !== primary.trim().toLowerCase())
    ) {
      category.detailed = detailed;
    }
    if (bt.category_confidence) {
      category.confidence_level = bt.category_confidence;
    }

    return {
      id: bt.id,
      account_id: bt.account_id,
      date: bt.date,
      name: bt.merchant_name || 'Unknown',
      merchant: bt.merchant_name,
      amount: bt.amount,
      pending: bt.pending,
      category,
      account_name: bt.account_name,
      account_type: bt.account_type,
      account_mask: bt.account_mask,
      provider: bt.provider,
      running_balance: bt.running_balance,
      location: bt.location,
      custom_category: bt.custom_category,
      custom_subcategory: bt.custom_subcategory,
      rule_category: bt.rule_category,
      rule_subcategory: bt.rule_subcategory,
    };
  }
}
