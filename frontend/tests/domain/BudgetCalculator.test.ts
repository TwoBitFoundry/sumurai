import { describe, it, expect } from 'vitest'
import { BudgetCalculator } from '@/domain/BudgetCalculator'
import type { Budget, Transaction } from '@/types/api'

describe('BudgetCalculator', () => {
  describe('calculateSpent', () => {
    it('should calculate total spent for a category within a date range', () => {
      const transactions: Transaction[] = [
        { id: '1', date: '2024-01-15', name: 'Coffee', amount: 5, category: { primary: 'FOOD_AND_DRINK' } },
        { id: '2', date: '2024-01-20', name: 'Lunch', amount: 15, category: { primary: 'FOOD_AND_DRINK' } },
        { id: '3', date: '2024-02-05', name: 'Coffee', amount: 5, category: { primary: 'FOOD_AND_DRINK' } },
      ]
      const spent = BudgetCalculator.calculateSpent(
        transactions,
        'FOOD_AND_DRINK',
        '2024-01-01',
        '2024-01-31'
      )
      expect(spent).toBe(20)
    })

    it('should return 0 if no transactions match', () => {
      const transactions: Transaction[] = [
        { id: '1', date: '2024-01-15', name: 'Coffee', amount: 5, category: { primary: 'FOOD_AND_DRINK' } },
      ]
      const spent = BudgetCalculator.calculateSpent(
        transactions,
        'TRANSPORTATION',
        '2024-01-01',
        '2024-01-31'
      )
      expect(spent).toBe(0)
    })

    it('should handle case-insensitive category matching', () => {
      const transactions: Transaction[] = [
        { id: '1', date: '2024-01-15', name: 'Coffee', amount: 5, category: { primary: 'food_and_drink' } },
      ]
      const spent = BudgetCalculator.calculateSpent(
        transactions,
        'FOOD_AND_DRINK',
        '2024-01-01',
        '2024-01-31'
      )
      expect(spent).toBe(5)
    })

    it('should exclude transactions outside date range', () => {
      const transactions: Transaction[] = [
        { id: '1', date: '2023-12-31', name: 'Coffee', amount: 5, category: { primary: 'FOOD_AND_DRINK' } },
        { id: '2', date: '2024-01-15', name: 'Lunch', amount: 15, category: { primary: 'FOOD_AND_DRINK' } },
        { id: '3', date: '2024-02-01', name: 'Dinner', amount: 25, category: { primary: 'FOOD_AND_DRINK' } },
      ]
      const spent = BudgetCalculator.calculateSpent(
        transactions,
        'FOOD_AND_DRINK',
        '2024-01-01',
        '2024-01-31'
      )
      expect(spent).toBe(15)
    })
  })

  describe('calculateRemaining', () => {
    it('should calculate remaining budget', () => {
      const remaining = BudgetCalculator.calculateRemaining(100, 40)
      expect(remaining).toBe(60)
    })

    it('should return 0 if spent exceeds budget', () => {
      const remaining = BudgetCalculator.calculateRemaining(100, 150)
      expect(remaining).toBe(0)
    })
  })

  describe('isOverBudget', () => {
    it('should return true if spent exceeds budget', () => {
      expect(BudgetCalculator.isOverBudget(100, 150)).toBe(true)
    })

    it('should return false if spent is within budget', () => {
      expect(BudgetCalculator.isOverBudget(100, 80)).toBe(false)
    })

    it('should return false if spent equals budget', () => {
      expect(BudgetCalculator.isOverBudget(100, 100)).toBe(false)
    })
  })

  describe('calculatePercentage', () => {
    it('should calculate percentage of budget spent', () => {
      const percentage = BudgetCalculator.calculatePercentage(100, 50)
      expect(percentage).toBe(50)
    })

    it('should cap percentage at 100', () => {
      const percentage = BudgetCalculator.calculatePercentage(100, 150)
      expect(percentage).toBe(100)
    })

    it('should return 0 if budget is 0', () => {
      const percentage = BudgetCalculator.calculatePercentage(0, 50)
      expect(percentage).toBe(0)
    })
  })
})
