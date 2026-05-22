/**
 * API access for transaction queries and updates.
 */

import { type BackendTransaction, TransactionTransformer } from '../domain/TransactionTransformer';
import type {
  PaginatedTransactionsResponse,
  Transaction,
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
  page?: number;
  page_size?: number;
}

interface BackendPaginatedTransactionsResponse {
  transactions: BackendTransaction[];
  total: number;
  page: number;
  page_size: number;
}

const DEFAULT_FETCH_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

export class TransactionService {
  static async getTransactions(filters?: TransactionFilters): Promise<Transaction[]>;
  static async getTransactions(
    filters: TransactionFilters & { page: number; page_size?: number }
  ): Promise<PaginatedTransactionsResponse>;
  static async getTransactions(
    filters: TransactionFilters & { page_size: number }
  ): Promise<PaginatedTransactionsResponse>;
  static async getTransactions(
    filters: TransactionFilters = {}
  ): Promise<Transaction[] | PaginatedTransactionsResponse> {
    if (hasPagination(filters)) {
      const page = normalizePage(filters.page);
      const pageSize = normalizePageSize(filters.page_size);
      const response = await ApiClient.get<BackendPaginatedTransactionsResponse>(
        buildTransactionsEndpoint(filters, page, pageSize)
      );
      return toPaginatedTransactionsResponse(response, page, pageSize);
    }

    return TransactionService.getAllTransactions(filters);
  }

  static async getTransactionCategories(): Promise<string[]> {
    const categories = await ApiClient.get<string[]>('/transactions/categories');
    return Array.isArray(categories) ? categories : [];
  }

  static async getTransactionsInsights(
    filters: TransactionFilters = {}
  ): Promise<TransactionsInsightsResponse> {
    return ApiClient.get<TransactionsInsightsResponse>(buildTransactionsInsightsEndpoint(filters));
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

  private static async getAllTransactions(filters: TransactionFilters): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;

    while (transactions.length < total) {
      const response = await ApiClient.get<BackendPaginatedTransactionsResponse>(
        buildTransactionsEndpoint(filters, page, DEFAULT_FETCH_PAGE_SIZE)
      );
      const paginated = toPaginatedTransactionsResponse(response, page, DEFAULT_FETCH_PAGE_SIZE);

      transactions.push(...paginated.transactions);
      total = paginated.total;

      if (
        paginated.transactions.length === 0 ||
        paginated.transactions.length < paginated.page_size
      ) {
        break;
      }

      page += 1;
    }

    return transactions;
  }
}

function hasPagination(filters: TransactionFilters): filters is TransactionFilters & {
  page: number;
} {
  return filters.page !== undefined || filters.page_size !== undefined;
}

function normalizePage(page?: number): number {
  if (!Number.isFinite(page ?? NaN)) {
    return 1;
  }
  return Math.max(1, Math.floor(page ?? 1));
}

function normalizePageSize(pageSize?: number): number {
  if (!Number.isFinite(pageSize ?? NaN)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.max(1, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE));
}

function buildTransactionsEndpoint(
  filters: TransactionFilters,
  page: number,
  pageSize: number
): string {
  const params = buildTransactionFiltersParams(filters);
  params.append('page', String(page));
  params.append('page_size', String(pageSize));

  const queryString = params.toString();
  return queryString ? `/transactions?${queryString}` : '/transactions';
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
  appendAccountQueryParams(params, filters.accountIds);

  return params;
}

function toPaginatedTransactionsResponse(
  response: BackendPaginatedTransactionsResponse | BackendTransaction[] | null | undefined,
  page: number,
  pageSize: number
): PaginatedTransactionsResponse {
  if (!response || Array.isArray(response)) {
    return {
      transactions: Array.isArray(response)
        ? response.map((transaction) => TransactionTransformer.backendToFrontend(transaction))
        : [],
      total: Array.isArray(response) ? response.length : 0,
      page,
      page_size: pageSize,
    };
  }

  const transactions = Array.isArray(response.transactions)
    ? response.transactions.map((transaction) =>
        TransactionTransformer.backendToFrontend(transaction)
      )
    : [];

  return {
    transactions,
    total: typeof response.total === 'number' ? response.total : transactions.length,
    page: typeof response.page === 'number' ? response.page : page,
    page_size: typeof response.page_size === 'number' ? response.page_size : pageSize,
  };
}
