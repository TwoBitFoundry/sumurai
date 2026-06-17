import type { Transaction } from '@/types/api';

export function transactionMerchantName(transaction: Transaction): string {
  return transaction.name.trim() || 'Unknown';
}
