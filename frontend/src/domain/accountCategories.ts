export type AccountCategoryType = 'cash' | 'credit' | 'investments' | 'loan';

export const ACCOUNT_GROUP_LABELS = {
  cash: 'Cash',
  credit: 'Credit',
  investments: 'Investments',
  loans: 'Loans',
} as const;

export type AccountGroupKey = keyof typeof ACCOUNT_GROUP_LABELS;

export const ACCOUNT_GROUP_ACCENT = {
  cash: 'teal',
  credit: 'crimson',
  investments: 'azure',
  loans: 'amber',
} as const;

export function accountTypeToGroup(type: AccountCategoryType): AccountGroupKey {
  switch (type) {
    case 'cash':
      return 'cash';
    case 'credit':
      return 'credit';
    case 'loan':
      return 'loans';
    case 'investments':
      return 'investments';
  }
}

export function mapStoredAccountTypeToUiType(value: string | undefined): AccountCategoryType {
  const normalized = (value ?? '').toLowerCase();
  switch (normalized) {
    case 'credit':
    case 'credit card':
      return 'credit';
    case 'loan':
    case 'loans':
      return 'loan';
    case 'investment':
    case 'investments':
      return 'investments';
    case 'checking':
    case 'depository':
    case 'savings':
    case 'cash':
      return 'cash';
    default:
      return 'investments';
  }
}

export const accountTypeSortOrder: Record<AccountCategoryType, number> = {
  cash: 1,
  credit: 2,
  investments: 3,
  loan: 4,
};

export const DIY_ACCOUNT_TYPE_OPTIONS = [
  { label: ACCOUNT_GROUP_LABELS.cash, value: 'depository' },
  { label: ACCOUNT_GROUP_LABELS.investments, value: 'investment' },
  { label: ACCOUNT_GROUP_LABELS.loans, value: 'loan' },
  { label: ACCOUNT_GROUP_LABELS.credit, value: 'credit' },
] as const;

export type DiyAccountTypeValue = (typeof DIY_ACCOUNT_TYPE_OPTIONS)[number]['value'];
