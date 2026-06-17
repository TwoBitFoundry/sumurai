import { transactionMerchantName } from '@/features/transactions/utils/transactionMerchantName';
import type { Transaction } from '@/types/api';

const baseTransaction: Transaction = {
  id: 'tx-1',
  date: '2026-05-31',
  name: 'Target',
  amount: -43.12,
  category: { primary: 'SHOPPING' },
  originalMerchantName: 'TARGET T-1234 SAN FRANCISCO CA',
};

describe('transactionMerchantName', () => {
  it('returns the display merchant name', () => {
    expect(transactionMerchantName(baseTransaction)).toBe('Target');
  });

  it('does not use the raw provider merchant name', () => {
    expect(transactionMerchantName(baseTransaction)).not.toBe(baseTransaction.originalMerchantName);
  });
});
