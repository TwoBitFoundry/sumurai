import type { BudgetProgressEntry } from '@/features/budgets/hooks/useBudgets';
import type { Budget } from '@/types/api';

export const sampleBudgets: Budget[] = [
  {
    id: 'story-budget-1',
    category: 'food_and_drink',
    amount: 500,
  },
  {
    id: 'story-budget-2',
    category: 'transportation',
    amount: 200,
  },
];

export const sampleBudgetProgressEntries: BudgetProgressEntry[] = [
  {
    ...sampleBudgets[0],
    spent: 412,
    percentage: 82,
  },
  {
    ...sampleBudgets[1],
    spent: 235,
    percentage: 100,
  },
  {
    id: 'story-budget-3',
    category: 'entertainment',
    amount: 150,
    spent: 188,
    percentage: 125,
  },
];
