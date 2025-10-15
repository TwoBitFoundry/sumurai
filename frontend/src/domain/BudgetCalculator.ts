import type { Transaction } from '../types/api'
import { formatCategoryName } from '../utils/categories'

export class BudgetCalculator {
  static calculateSpent(
    transactions: Transaction[],
    categoryId: string,
    start: string,
    end: string
  ): number {
    return transactions
      .filter(t => {
        const primary = t.category?.primary || ''
        const primaryMatches = primary.toLowerCase() === categoryId.toLowerCase()
        const primaryFriendlyMatches = formatCategoryName(primary).toLowerCase() === formatCategoryName(categoryId).toLowerCase()
        return primaryMatches || primaryFriendlyMatches
      })
      .filter(t => {
        const dateString = new Date(t.date).toISOString().slice(0, 10)
        return dateString >= start && dateString <= end
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  }

  static calculateRemaining(budget: number, spent: number): number {
    return Math.max(0, budget - spent)
  }

  static isOverBudget(budget: number, spent: number): boolean {
    return spent > budget
  }

  static calculatePercentage(budget: number, spent: number): number {
    if (budget === 0) return 0
    return Math.min(100, (spent / budget) * 100)
  }
}
