import { TransactionFilter } from '@/domain/TransactionFilter'
import type { Transaction } from '@/types/api'

describe('TransactionFilter', () => {
  const sampleTransactions: Transaction[] = [
    {
      id: '1',
      date: '2024-01-15',
      name: 'Starbucks',
      merchant: 'Starbucks',
      amount: 5,
      category: { primary: 'FOOD_AND_DRINK' },
    },
    {
      id: '2',
      date: '2024-01-20',
      name: 'Uber',
      merchant: 'Uber',
      amount: 15,
      category: { primary: 'TRANSPORTATION' },
    },
    {
      id: '3',
      date: '2024-02-05',
      name: 'Grocery Store',
      merchant: 'Whole Foods',
      amount: 50,
      category: { primary: 'FOOD_AND_DRINK' },
    },
  ]

  describe('filterBySearch', () => {
    it('should filter transactions by name', () => {
      const result = TransactionFilter.filterBySearch(sampleTransactions, 'starbucks')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('should filter transactions by merchant', () => {
      const result = TransactionFilter.filterBySearch(sampleTransactions, 'uber')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('should be case-insensitive', () => {
      const result = TransactionFilter.filterBySearch(sampleTransactions, 'STARBUCKS')
      expect(result).toHaveLength(1)
    })

    it('should return all transactions if search is empty', () => {
      const result = TransactionFilter.filterBySearch(sampleTransactions, '')
      expect(result).toHaveLength(3)
    })

    it('should return empty array if no matches', () => {
      const result = TransactionFilter.filterBySearch(sampleTransactions, 'xyz')
      expect(result).toHaveLength(0)
    })
  })

  describe('filterByCategory', () => {
    it('should filter transactions by category', () => {
      const result = TransactionFilter.filterByCategory(sampleTransactions, 'FOOD_AND_DRINK')
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[1].id).toBe('3')
    })

    it('should be case-insensitive', () => {
      const result = TransactionFilter.filterByCategory(sampleTransactions, 'food_and_drink')
      expect(result).toHaveLength(2)
    })

    it('should return empty array if category not found', () => {
      const result = TransactionFilter.filterByCategory(sampleTransactions, 'UNKNOWN')
      expect(result).toHaveLength(0)
    })
  })

  describe('filterByDateRange', () => {
    it('should filter transactions within date range', () => {
      const result = TransactionFilter.filterByDateRange(
        sampleTransactions,
        '2024-01-01',
        '2024-01-31'
      )
      expect(result).toHaveLength(2)
    })

    it('should exclude transactions outside range', () => {
      const result = TransactionFilter.filterByDateRange(
        sampleTransactions,
        '2024-02-01',
        '2024-02-28'
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('3')
    })

    it('should include boundary dates', () => {
      const transactions: Transaction[] = [
        { id: '1', date: '2024-01-01', name: 'Txn', amount: 10, category: { primary: 'OTHER' } },
        { id: '2', date: '2024-01-15', name: 'Txn', amount: 10, category: { primary: 'OTHER' } },
        { id: '3', date: '2024-01-31', name: 'Txn', amount: 10, category: { primary: 'OTHER' } },
      ]
      const result = TransactionFilter.filterByDateRange(
        transactions,
        '2024-01-01',
        '2024-01-31'
      )
      expect(result).toHaveLength(3)
    })
  })

  describe('sortByDate', () => {
    it('should sort transactions by date descending', () => {
      const result = TransactionFilter.sortByDate(sampleTransactions)
      expect(result[0].date).toBe('2024-02-05')
      expect(result[1].date).toBe('2024-01-20')
      expect(result[2].date).toBe('2024-01-15')
    })

    it('should not mutate original array', () => {
      const original = [...sampleTransactions]
      TransactionFilter.sortByDate(sampleTransactions)
      expect(sampleTransactions).toEqual(original)
    })
  })

  describe('filter', () => {
    it('should apply multiple filters in sequence', () => {
      const result = TransactionFilter.filter(sampleTransactions, {
        category: 'FOOD_AND_DRINK',
        dateRange: { start: '2024-01-01', end: '2024-01-31' },
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('should apply search filter', () => {
      const result = TransactionFilter.filter(sampleTransactions, {
        search: 'whole',
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('3')
    })

    it('should return all transactions with no filters', () => {
      const result = TransactionFilter.filter(sampleTransactions, {})
      expect(result).toHaveLength(3)
    })

    it('should return sorted results by default', () => {
      const result = TransactionFilter.filter(sampleTransactions, {})
      expect(result[0].date >= result[1].date).toBe(true)
    })
  })
})
