import { ApiClient } from './ApiClient';
import type { Transaction } from '../types/api';
import { appendAccountQueryParams } from '../utils/queryParams';
import { TransactionTransformer, type BackendTransaction } from '../domain/TransactionTransformer';

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  searchTerm?: string;
  search?: string;
  dateRange?: string;
  accountIds?: string[];
}

export class TransactionService {
  static async getTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
    let endpoint = '/transactions';

    if (filters) {
      const params = new URLSearchParams();

      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);
      if (filters.search) params.append('search', filters.search);
      if (filters.dateRange) params.append('dateRange', filters.dateRange);
      appendAccountQueryParams(params, filters.accountIds);

      const queryString = params.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }
    }

    const backendTransactions = await ApiClient.get<BackendTransaction[]>(endpoint);

    if (!Array.isArray(backendTransactions)) {
      return [];
    }

    return backendTransactions.map((bt) => TransactionTransformer.backendToFrontend(bt));
  }
}
