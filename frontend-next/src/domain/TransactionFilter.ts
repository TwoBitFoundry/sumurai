import type { Transaction } from '../types/api';
import { formatCategoryName } from '../utils/categories';

export interface FilterCriteria {
  search?: string;
  category?: string;
  dateRange?: { start: string; end: string };
}

export class TransactionFilter {
  static filterBySearch(transactions: Transaction[], search: string): Transaction[] {
    const s = search.trim().toLowerCase();
    if (!s) return transactions;
    return transactions.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const merchant = (t.merchant || '').toLowerCase();
      return name.includes(s) || merchant.includes(s);
    });
  }

  static filterByCategory(transactions: Transaction[], category: string): Transaction[] {
    const catLower = category.toLowerCase();
    return transactions.filter((t) => {
      const primary = t.category?.primary || '';
      const primaryMatches = primary.toLowerCase() === catLower;
      const primaryFriendlyMatches =
        formatCategoryName(primary).toLowerCase() === formatCategoryName(category).toLowerCase();
      return primaryMatches || primaryFriendlyMatches;
    });
  }

  static filterByDateRange(transactions: Transaction[], start: string, end: string): Transaction[] {
    return transactions.filter((t) => {
      const dateString = new Date(t.date).toISOString().slice(0, 10);
      return dateString >= start && dateString <= end;
    });
  }

  static sortByDate(transactions: Transaction[]): Transaction[] {
    return [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  static filter(transactions: Transaction[], criteria: FilterCriteria): Transaction[] {
    let result = transactions;

    if (criteria.search) {
      result = this.filterBySearch(result, criteria.search);
    }

    if (criteria.category) {
      result = this.filterByCategory(result, criteria.category);
    }

    if (criteria.dateRange) {
      result = this.filterByDateRange(result, criteria.dateRange.start, criteria.dateRange.end);
    }

    return this.sortByDate(result);
  }
}
