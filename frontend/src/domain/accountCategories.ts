export type AccountCategoryType = 'checking' | 'savings' | 'credit' | 'loan' | 'other';

export const ACCOUNT_GROUP_LABELS = {
  cash: 'Cash',
  credit: 'Credit',
  investments: 'Investments',
  loans: 'Loans',
} as const;

export type AccountGroupKey = keyof typeof ACCOUNT_GROUP_LABELS;

export const ACCOUNT_GROUP_ACCENT = {
  cash: 'emerald',
  credit: 'rose',
  investments: 'sky',
  loans: 'amber',
} as const;

export function accountTypeToGroup(type: AccountCategoryType): AccountGroupKey {
  switch (type) {
    case 'checking':
    case 'savings':
      return 'cash';
    case 'credit':
      return 'credit';
    case 'loan':
      return 'loans';
    default:
      return 'investments';
  }
}

export const accountTypeSortOrder: Record<AccountCategoryType, number> = {
  checking: 1,
  savings: 1,
  credit: 2,
  other: 3,
  loan: 4,
};
