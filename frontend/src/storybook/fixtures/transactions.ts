import type { Transaction } from '@/types/api';
import { STORY_FIXED_ISO } from './time';

export const sampleTransactions: Transaction[] = [
  {
    id: 'story-tx-1',
    date: STORY_FIXED_ISO,
    name: 'Sample Market',
    merchant: 'Sample Market',
    amount: -42.5,
    category: { primary: 'food_and_drink' },
    provider: 'plaid',
    account_name: 'Checking',
    account_type: 'depository',
    account_mask: '1234',
  },
  {
    id: 'story-tx-2',
    date: STORY_FIXED_ISO,
    name: 'Payroll Deposit',
    merchant: 'Employer Inc',
    amount: 3200,
    category: { primary: 'income' },
    provider: 'plaid',
    account_name: 'Checking',
    account_type: 'depository',
    account_mask: '1234',
  },
];
