import type { Transaction } from '../types/api'
import { formatCategoryName } from '../utils/categories'

interface ComputedBudget {
  id: string
  category: string
  amount: number
  spent: number
}

export interface BudgetStats {
  totalBudgeted: number
  totalSpent: number
  remaining: number
  variance: number
  overBudgetCount: number
  overBudgetCategories: string[]
  daysRemaining: number
  totalDays: number
  activeBudgetCategories: string[]
  nearLimitCategories: string[]
}

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

  static computeStats(computedBudgets: ComputedBudget[], month: Date): BudgetStats {
    const year = month.getFullYear()
    const monthNum = month.getMonth()
    const lastDay = new Date(year, monthNum + 1, 0).getDate()

    if (!computedBudgets.length) {
      return {
        totalBudgeted: 0,
        totalSpent: 0,
        remaining: 0,
        variance: 0,
        overBudgetCount: 0,
        overBudgetCategories: [],
        daysRemaining: 0,
        totalDays: lastDay,
        activeBudgetCategories: [],
        nearLimitCategories: [],
      }
    }

    const totals = computedBudgets.reduce(
      (acc, budget) => {
        acc.totalBudgeted += budget.amount
        acc.totalSpent += budget.spent
        if (budget.spent > budget.amount) {
          acc.overBudgetCount += 1
          acc.overBudgetCategories.push(budget.category)
        }
        return acc
      },
      { totalBudgeted: 0, totalSpent: 0, overBudgetCount: 0, overBudgetCategories: [] as string[] }
    )

    const variance = totals.totalBudgeted - totals.totalSpent

    const now = new Date()

    let daysRemaining = 0
    if (now.getFullYear() === year && now.getMonth() === monthNum) {
      daysRemaining = Math.max(0, lastDay - now.getDate())
    } else if (now.getFullYear() < year || (now.getFullYear() === year && now.getMonth() < monthNum)) {
      daysRemaining = lastDay
    } else {
      daysRemaining = 0
    }

    const activeBudgetCategories = computedBudgets.map(b => b.category)

    const nearLimitCategories = computedBudgets
      .filter(b => {
        const utilization = b.amount > 0 ? b.spent / b.amount : 0
        return utilization >= 0.8 && utilization < 1.0
      })
      .slice(0, 3)
      .map(b => b.category)

    return {
      totalBudgeted: totals.totalBudgeted,
      totalSpent: totals.totalSpent,
      remaining: Math.max(0, totals.totalBudgeted - totals.totalSpent),
      variance,
      overBudgetCount: totals.overBudgetCount,
      overBudgetCategories: totals.overBudgetCategories,
      daysRemaining,
      totalDays: lastDay,
      activeBudgetCategories,
      nearLimitCategories,
    }
  }
}
