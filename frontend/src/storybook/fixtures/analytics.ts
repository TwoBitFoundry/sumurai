import type { DonutDatum } from '@/features/analytics/adapters/chartData';
import type { AnalyticsTopMerchantsResponse } from '@/types/api';
import { buildCategoryAccentIndex } from '@/utils/categories';

export const sampleDonutByCategory: DonutDatum[] = [
  { name: 'Food', categoryKey: 'food_and_drink', value: 420 },
  { name: 'Transit', categoryKey: 'transportation', value: 188 },
  { name: 'Income', categoryKey: 'income', value: 3100 },
  { name: 'Shopping', categoryKey: 'shopping', value: 240 },
];

export const sampleDonutTotal = sampleDonutByCategory.reduce((s, d) => s + d.value, 0);

export const sampleTopMerchants: AnalyticsTopMerchantsResponse[] = [
  { name: 'Corner Market', amount: 412.5, count: 14, percentage: 22 },
  { name: 'Transit Authority', amount: 188.0, count: 28, percentage: 10 },
  { name: 'Employer Payroll', amount: 3100.0, count: 2, percentage: 44 },
  { name: 'Regional Utility Co', amount: 96.2, count: 3, percentage: 5 },
  { name: 'Coffee Collective Wholesale Roasters Group', amount: 72.4, count: 11, percentage: 4 },
];

const sampleSankeyCategories = [
  'food_and_drink',
  'transportation',
  'shopping',
  'subscription',
] as const;

export const sampleSankeyAccentIndexByName = buildCategoryAccentIndex(sampleSankeyCategories);

export const sampleSankeyDeficit = {
  nodes: [
    { id: 'income', label: 'Income', kind: 'Income' as const },
    { id: 'expenses', label: 'Expenses', kind: 'Expenses' as const },
    { id: 'debt', label: 'Debt', kind: 'Deficit' as const },
    { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' as const },
    { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' as const },
    { id: 'transportation', label: 'Transport', kind: 'Category' as const },
    { id: 'shopping', label: 'Shopping', kind: 'Category' as const },
  ],
  links: [
    { source: 'income', target: 'expenses', value: 1200 },
    { source: 'debt', target: 'expenses', value: 300 },
    { source: 'expenses', target: 'free_spending', value: 1500 },
    { source: 'free_spending', target: 'food_and_drink', value: 700 },
    { source: 'free_spending', target: 'transportation', value: 500 },
    { source: 'free_spending', target: 'shopping', value: 300 },
  ],
  currency: 'USD',
  summary: {
    income: 1200,
    expenses: 1500,
    covered: 1200,
    deficit: 300,
    surplus: 0,
    coverage_ratio: 0.8,
  },
};

export const sampleSankeySurplus = {
  nodes: [
    { id: 'income', label: 'Income', kind: 'Income' as const },
    { id: 'expenses', label: 'Expenses', kind: 'Expenses' as const },
    { id: 'savings', label: 'Savings', kind: 'Savings' as const },
    { id: 'fixed_expenses', label: 'Fixed Expenses', kind: 'FixedExpenses' as const },
    { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' as const },
    { id: 'subscription', label: 'SUBSCRIPTION', kind: 'Category' as const },
    { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' as const },
    { id: 'transportation', label: 'Transport', kind: 'Category' as const },
    { id: 'shopping', label: 'Shopping', kind: 'Category' as const },
  ],
  links: [
    { source: 'income', target: 'expenses', value: 1500 },
    { source: 'income', target: 'savings', value: 100 },
    { source: 'expenses', target: 'fixed_expenses', value: 150 },
    { source: 'expenses', target: 'free_spending', value: 1350 },
    { source: 'fixed_expenses', target: 'subscription', value: 150 },
    { source: 'free_spending', target: 'food_and_drink', value: 700 },
    { source: 'free_spending', target: 'transportation', value: 500 },
    { source: 'free_spending', target: 'shopping', value: 150 },
  ],
  currency: 'USD',
  summary: {
    income: 1600,
    expenses: 1500,
    covered: 1500,
    deficit: 0,
    surplus: 100,
    coverage_ratio: 1,
  },
};

export const sampleSankeyNoIncome = {
  nodes: [
    { id: 'expenses', label: 'Expenses', kind: 'Expenses' as const },
    { id: 'debt', label: 'Debt', kind: 'Deficit' as const },
    { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' as const },
    { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' as const },
    { id: 'transportation', label: 'Transport', kind: 'Category' as const },
    { id: 'shopping', label: 'Shopping', kind: 'Category' as const },
  ],
  links: [
    { source: 'debt', target: 'expenses', value: 1500 },
    { source: 'expenses', target: 'free_spending', value: 1500 },
    { source: 'free_spending', target: 'food_and_drink', value: 700 },
    { source: 'free_spending', target: 'transportation', value: 500 },
    { source: 'free_spending', target: 'shopping', value: 300 },
  ],
  currency: 'USD',
  summary: {
    income: 0,
    expenses: 1500,
    covered: 0,
    deficit: 1500,
    surplus: 0,
    coverage_ratio: 0,
  },
};

export const sampleSankeyEmpty = {
  nodes: [],
  links: [],
  currency: 'USD',
  summary: {
    income: 0,
    expenses: 0,
    covered: 0,
    deficit: 0,
    surplus: 0,
    coverage_ratio: null,
  },
};
