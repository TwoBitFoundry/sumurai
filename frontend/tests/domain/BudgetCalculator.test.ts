import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BudgetCalculator } from '../../src/domain/BudgetCalculator'

interface ComputedBudget {
  id: string
  category: string
  amount: number
  spent: number
}

const mockToday = new Date('2025-10-15')

describe('BudgetCalculator.computeStats', () => {
  beforeEach(() => {
    vi.setSystemTime(mockToday)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('with empty budgets', () => {
    it('returns zero values for all stats', () => {
      const stats = BudgetCalculator.computeStats([], mockToday)

      expect(stats.totalBudgeted).toBe(0)
      expect(stats.totalSpent).toBe(0)
      expect(stats.remaining).toBe(0)
      expect(stats.variance).toBe(0)
      expect(stats.overBudgetCount).toBe(0)
      expect(stats.overBudgetCategories).toEqual([])
      expect(stats.activeBudgetCategories).toEqual([])
      expect(stats.nearLimitCategories).toEqual([])
    })
  })

  describe('with single budget', () => {
    it('calculates totals correctly when under budget', () => {
      const budgets: ComputedBudget[] = [
        { id: '1', category: 'Food', amount: 500, spent: 300 }
      ]

      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.totalBudgeted).toBe(500)
      expect(stats.totalSpent).toBe(300)
      expect(stats.remaining).toBe(200)
      expect(stats.variance).toBe(200)
      expect(stats.overBudgetCount).toBe(0)
      expect(stats.overBudgetCategories).toEqual([])
    })

    it('detects when over budget', () => {
      const budgets: ComputedBudget[] = [
        { id: '1', category: 'Food', amount: 300, spent: 500 }
      ]

      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.overBudgetCount).toBe(1)
      expect(stats.overBudgetCategories).toEqual(['Food'])
      expect(stats.variance).toBe(-200)
    })

    it('includes category in activeBudgetCategories', () => {
      const budgets: ComputedBudget[] = [
        { id: '1', category: 'Food', amount: 500, spent: 300 }
      ]

      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.activeBudgetCategories).toEqual(['Food'])
    })

    it('identifies categories near limit (80-100%)', () => {
      const budgets: ComputedBudget[] = [
        { id: '1', category: 'Food', amount: 100, spent: 90 }
      ]

      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.nearLimitCategories).toEqual(['Food'])
    })

    it('excludes categories below 80% utilization from nearLimitCategories', () => {
      const budgets: ComputedBudget[] = [
        { id: '1', category: 'Food', amount: 100, spent: 70 }
      ]

      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.nearLimitCategories).toEqual([])
    })

    it('excludes over-budget categories from nearLimitCategories', () => {
      const budgets: ComputedBudget[] = [
        { id: '1', category: 'Food', amount: 100, spent: 120 }
      ]

      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.nearLimitCategories).toEqual([])
    })
  })

  describe('with multiple budgets', () => {
    let budgets: ComputedBudget[]

    beforeEach(() => {
      budgets = [
        { id: '1', category: 'Food', amount: 500, spent: 300 },
        { id: '2', category: 'Transport', amount: 200, spent: 250 },
        { id: '3', category: 'Entertainment', amount: 150, spent: 120 }
      ]
    })

    it('sums all budgets and spending', () => {
      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.totalBudgeted).toBe(850)
      expect(stats.totalSpent).toBe(670)
      expect(stats.remaining).toBe(180)
      expect(stats.variance).toBe(180)
    })

    it('counts all over-budget categories', () => {
      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.overBudgetCount).toBe(1)
      expect(stats.overBudgetCategories).toContain('Transport')
    })

    it('lists all active categories', () => {
      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.activeBudgetCategories).toEqual(['Food', 'Transport', 'Entertainment'])
    })

    it('limits nearLimitCategories to 3 items', () => {
      const manyBudgets: ComputedBudget[] = [
        { id: '1', category: 'Cat1', amount: 100, spent: 85 },
        { id: '2', category: 'Cat2', amount: 100, spent: 85 },
        { id: '3', category: 'Cat3', amount: 100, spent: 85 },
        { id: '4', category: 'Cat4', amount: 100, spent: 85 }
      ]

      const stats = BudgetCalculator.computeStats(manyBudgets, new Date('2025-10-15'))

      expect(stats.nearLimitCategories).toHaveLength(3)
    })
  })

  describe('days remaining and total days calculation', () => {
    it('returns correct total days in month regardless of date', () => {
      const october = new Date('2025-10-15')
      const stats = BudgetCalculator.computeStats([], october)
      expect(stats.totalDays).toBe(31)

      const november = new Date('2025-11-15')
      const statsNov = BudgetCalculator.computeStats([], november)
      expect(statsNov.totalDays).toBe(30)

      const february = new Date('2025-02-28')
      const statsFeb = BudgetCalculator.computeStats([], february)
      expect(statsFeb.totalDays).toBe(28)
    })
  })

  describe('remaining calculation', () => {
    it('returns positive remaining when under budget', () => {
      const budgets: ComputedBudget[] = [
        { id: '1', category: 'Food', amount: 500, spent: 300 }
      ]

      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.remaining).toBe(200)
    })

    it('returns zero remaining when over budget', () => {
      const budgets: ComputedBudget[] = [
        { id: '1', category: 'Food', amount: 300, spent: 500 }
      ]

      const stats = BudgetCalculator.computeStats(budgets, mockToday)

      expect(stats.remaining).toBe(0)
    })
  })
})
