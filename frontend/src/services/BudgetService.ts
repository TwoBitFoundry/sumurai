/**
 * API access for budget operations.
 */

import type { Budget, BudgetsOverviewResponse, FixedExpenseSummary } from '../types/api';
import { ApiClient } from './ApiClient';

type BudgetRecord = {
  id: string;
  category: string;
  amount: number | string;
};

type OverviewRecord = {
  budgets: BudgetRecord[];
  fixed_expenses: FixedExpenseSummary[];
};

export class BudgetService {
  static async getOverview(): Promise<BudgetsOverviewResponse> {
    const response = await ApiClient.get<OverviewRecord>('/budgets/overview');
    return {
      budgets: response.budgets.map((b) => ({
        id: b.id,
        category: b.category,
        amount: Number(b.amount),
      })),
      fixed_expenses: response.fixed_expenses,
    };
  }

  static async getBudgets(): Promise<Budget[]> {
    const budgets = await ApiClient.get<BudgetRecord[]>('/budgets');
    return budgets.map((b) => ({ id: b.id, category: b.category, amount: Number(b.amount) }));
  }

  static async createBudget(budgetData: { category: string; amount: number }): Promise<Budget> {
    const payload = { category: budgetData.category, amount: String(budgetData.amount) };
    const created = await ApiClient.post<BudgetRecord>('/budgets', payload);
    return {
      id: created.id,
      category: created.category,
      amount: Number(created.amount ?? budgetData.amount),
    };
  }

  static async updateBudget(id: string, budgetData: Partial<Budget>): Promise<Budget> {
    const payload: Partial<Record<'category' | 'amount', string>> = {};
    if (budgetData.category) {
      payload.category = budgetData.category;
    }
    if (typeof budgetData.amount === 'number') {
      payload.amount = String(budgetData.amount);
    }
    const updated = await ApiClient.put<BudgetRecord>(`/budgets/${id}`, payload);
    return {
      id: updated.id,
      category: updated.category,
      amount: Number(updated.amount ?? budgetData.amount ?? 0),
    };
  }

  static async deleteBudget(id: string): Promise<void> {
    return ApiClient.delete(`/budgets/${id}`);
  }
}
