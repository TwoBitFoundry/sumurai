import type { Transaction } from '@/types/api';
import { STORY_FIXED_ISO } from './time';

const baseTx = (): Omit<Transaction, 'id' | 'name' | 'merchant' | 'amount' | 'category'> => ({
  date: STORY_FIXED_ISO,
  provider: 'plaid',
  account_name: 'Checking',
  account_type: 'depository',
  account_mask: '1234',
});

export const sampleTransactions: Transaction[] = [
  {
    id: 'story-tx-1',
    name: 'Sample Market',
    merchant: 'Sample Market',
    amount: -42.5,
    category: { primary: 'food_and_drink' },
    ...baseTx(),
  },
  {
    id: 'story-tx-2',
    name: 'Payroll Deposit',
    merchant: 'Employer Inc',
    amount: 3200,
    category: { primary: 'income' },
    ...baseTx(),
  },
];

export const denseLabelTransaction: Transaction = {
  id: 'story-tx-dense',
  date: STORY_FIXED_ISO,
  name: 'International Artisan Coffee Roasters Collective Wholesale Market LLC',
  merchant: 'International Artisan Coffee Roasters Collective Wholesale Market LLC',
  amount: -12.34,
  category: { primary: 'food_and_drink' },
  provider: 'plaid',
  account_name: 'Premium Rewards Checking Account With Extended Product Name',
  account_type: 'depository',
  account_mask: '9876',
};

export const transactionsTablePage: Transaction[] = [
  {
    id: 'story-tx-tb-1',
    name: 'Transit Tap',
    merchant: 'Transit Tap',
    amount: -2.75,
    category: { primary: 'transportation' },
    ...baseTx(),
  },
  {
    id: 'story-tx-tb-2',
    name: 'Payroll',
    merchant: 'Employer Inc',
    amount: 3200,
    category: { primary: 'income' },
    ...baseTx(),
  },
  {
    id: 'story-tx-tb-3',
    name: 'Grocery Run',
    merchant: 'Grocery Run',
    amount: -86.4,
    category: { primary: 'food_and_drink' },
    ...baseTx(),
  },
  {
    id: 'story-tx-tb-4',
    name: 'Streaming',
    merchant: 'Streaming',
    amount: -15.99,
    category: { primary: 'entertainment' },
    ...baseTx(),
  },
  {
    id: 'story-tx-tb-5',
    name: 'Electric Bill',
    merchant: 'Utility Co',
    amount: -142.0,
    category: { primary: 'bills_and_utilities' },
    ...baseTx(),
  },
  {
    id: 'story-tx-tb-6',
    name: 'Pharmacy',
    merchant: 'Pharmacy',
    amount: -28.5,
    category: { primary: 'health_and_wellness' },
    ...baseTx(),
  },
  {
    id: 'story-tx-tb-7',
    name: 'Coffee Collective Wholesale Roasters Group International',
    merchant: 'Coffee Collective Wholesale Roasters Group International',
    amount: -6.25,
    category: { primary: 'food_and_drink' },
    ...baseTx(),
  },
  {
    id: 'story-tx-tb-8',
    name: 'Interest',
    merchant: 'Story Bank',
    amount: 0.42,
    category: { primary: 'income' },
    ...baseTx(),
  },
];
