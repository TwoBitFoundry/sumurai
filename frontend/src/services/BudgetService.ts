import type { Budget, BudgetFrequency } from '../types/api';
import { ApiClient } from './ApiClient';

type BudgetRecord = {
  id: string;
  category: string;
  amount: number | string;
  frequency?: BudgetFrequency;
  rollover?: boolean;
  rollover_start_month?: string;
  created_at?: string;
};

export class BudgetService {
  // Return plain budgets; map any legacy month field away.
  static async getBudgets(): Promise<Budget[]> {
    const budgets = await ApiClient.get<BudgetRecord[]>('/budgets');
    return budgets.map((b) => {
      const budget: Budget = {
        id: b.id,
        category: b.category,
        amount: Number(b.amount),
      };
      if (b.frequency !== undefined) {
        budget.frequency = b.frequency;
      }
      if (b.rollover !== undefined) {
        budget.rollover = b.rollover;
      }
      if (b.rollover_start_month !== undefined) {
        budget.rollover_start_month = b.rollover_start_month;
      }
      if (b.created_at !== undefined) {
        budget.created_at = b.created_at;
      }
      return budget;
    });
  }

  static async createBudget(budgetData: {
    category: string;
    amount: number;
    frequency?: BudgetFrequency;
    rollover?: boolean;
    rollover_start_month?: string;
  }): Promise<Budget> {
    const payload: Record<string, unknown> = {
      category: budgetData.category,
      amount: String(budgetData.amount),
    };
    if (budgetData.frequency !== undefined) {
      payload.frequency = budgetData.frequency;
    }
    if (budgetData.rollover !== undefined) {
      payload.rollover = budgetData.rollover;
    }
    if (budgetData.rollover_start_month !== undefined) {
      payload.rollover_start_month = budgetData.rollover_start_month;
    }
    const created = await ApiClient.post<BudgetRecord>('/budgets', payload);
    const result: Budget = {
      id: created.id,
      category: created.category,
      amount: Number(created.amount ?? budgetData.amount),
    };
    if (created.frequency !== undefined || budgetData.frequency !== undefined) {
      result.frequency = created.frequency ?? budgetData.frequency;
    }
    if (created.rollover !== undefined || budgetData.rollover !== undefined) {
      result.rollover = created.rollover ?? budgetData.rollover;
    }
    if (
      created.rollover_start_month !== undefined ||
      budgetData.rollover_start_month !== undefined
    ) {
      result.rollover_start_month = created.rollover_start_month ?? budgetData.rollover_start_month;
    }
    if (created.created_at !== undefined) {
      result.created_at = created.created_at;
    }
    return result;
  }

  static async updateBudget(id: string, budgetData: Partial<Budget>): Promise<Budget> {
    const payload: Record<string, unknown> = {};
    if (budgetData.category) {
      payload.category = budgetData.category;
    }
    if (typeof budgetData.amount === 'number') {
      payload.amount = String(budgetData.amount);
    }
    if (budgetData.frequency !== undefined) {
      payload.frequency = budgetData.frequency;
    }
    if (budgetData.rollover !== undefined) {
      payload.rollover = budgetData.rollover;
    }
    if (budgetData.rollover_start_month !== undefined) {
      payload.rollover_start_month = budgetData.rollover_start_month;
    }
    const updated = await ApiClient.put<BudgetRecord>(`/budgets/${id}`, payload);
    const result: Budget = {
      id: updated.id,
      category: updated.category,
      amount: Number(updated.amount ?? budgetData.amount ?? 0),
    };
    if (updated.frequency !== undefined || budgetData.frequency !== undefined) {
      result.frequency = updated.frequency ?? budgetData.frequency;
    }
    if (updated.rollover !== undefined || budgetData.rollover !== undefined) {
      result.rollover = updated.rollover ?? budgetData.rollover;
    }
    if (
      updated.rollover_start_month !== undefined ||
      budgetData.rollover_start_month !== undefined
    ) {
      result.rollover_start_month = updated.rollover_start_month ?? budgetData.rollover_start_month;
    }
    if (updated.created_at !== undefined) {
      result.created_at = updated.created_at;
    }
    return result;
  }

  static async deleteBudget(id: string): Promise<void> {
    return ApiClient.delete(`/budgets/${id}`);
  }
}
