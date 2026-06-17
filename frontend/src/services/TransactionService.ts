/**
 * API access for transaction queries and updates.
 */

import { type BackendTransaction, TransactionTransformer } from '../domain/TransactionTransformer';
import type {
  ContextualInsightsResponse,
  CursorTransactionsResponse,
  TransactionsInsightsResponse,
} from '../types/api';
import { appendAccountQueryParams } from '../utils/queryParams';
import { ApiClient } from './ApiClient';

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  categoryPrimary?: string;
  searchTerm?: string;
  search?: string;
  dateRange?: string;
  accountIds?: string[];
  merchant?: string;
  cursor?: string;
  limit?: number;
}

export class TransactionService {
  static async getTransactionCategories(): Promise<string[]> {
    const categories = await ApiClient.get<string[]>('/transactions/categories');
    return Array.isArray(categories) ? categories : [];
  }

  static async getTransactionsInsights(
    filters: TransactionFilters = {}
  ): Promise<TransactionsInsightsResponse> {
    return ApiClient.get<TransactionsInsightsResponse>(buildTransactionsInsightsEndpoint(filters));
  }

  static async getTransactionsContextualInsights(
    filters: TransactionFilters = {}
  ): Promise<ContextualInsightsResponse> {
    const params = buildTransactionFiltersParams(filters);
    const queryString = params.toString();
    const url = queryString
      ? `/transactions/contextual-insights?${queryString}`
      : '/transactions/contextual-insights';
    return ApiClient.get<ContextualInsightsResponse>(url);
  }

  static async getTransactionsPage(
    filters: TransactionFilters & { cursor?: string; limit?: number } = {}
  ): Promise<CursorTransactionsResponse> {
    const params = buildTransactionFiltersParams(filters);
    if (filters.cursor) params.append('cursor', filters.cursor);
    if (filters.limit != null) params.append('limit', String(filters.limit));
    const queryString = params.toString();
    const url = queryString ? `/transactions?${queryString}` : '/transactions';
    const raw = await ApiClient.get<BackendCursorTransactionsResponse>(url);
    return {
      ...raw,
      transactions: raw.transactions.map((t) => TransactionTransformer.backendToFrontend(t)),
    };
  }

  static async updateTransactionCategory(
    id: string,
    categoryName: string,
    isCustom: boolean
  ): Promise<void> {
    await ApiClient.put(`/transactions/${id}/category`, {
      category_name: categoryName,
      is_custom: isCustom,
    });
  }
}

interface BackendCursorTransactionsResponse {
  transactions: BackendTransaction[];
  next_cursor: string | null;
  prev_cursor: string | null;
  has_more: boolean;
}

function buildTransactionsInsightsEndpoint(filters: TransactionFilters): string {
  const params = buildTransactionFiltersParams(filters);
  const queryString = params.toString();
  return queryString ? `/transactions/insights?${queryString}` : '/transactions/insights';
}

function buildTransactionFiltersParams(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.startDate) params.append('start_date', filters.startDate);
  if (filters.endDate) params.append('end_date', filters.endDate);
  if (filters.categoryPrimary) params.append('category_primary', filters.categoryPrimary);
  if (filters.categoryId) params.append('category_primary', filters.categoryId);
  if (filters.search) params.append('search', filters.search);
  if (filters.searchTerm) params.append('search', filters.searchTerm);
  if (filters.merchant) params.append('merchant', filters.merchant);
  appendAccountQueryParams(params, filters.accountIds);

  return params;
}
