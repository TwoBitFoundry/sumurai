/**
 * API access for analytics and dashboard metrics.
 */

import type { BalancesOverview } from '../types/analytics';
import type {
  AnalyticsCashFlowPoint,
  AnalyticsCashFlowResponse,
  AnalyticsCategoryResponse,
  AnalyticsMonthlyTotalsResponse,
  AnalyticsSpendingResponse,
  AnalyticsTopMerchantsResponse,
} from '../types/api';
import { appendAccountQueryParams } from '../utils/queryParams';
import { ApiClient } from './ApiClient';

export class AnalyticsService {
  static async getCurrentMonthSpending(): Promise<AnalyticsSpendingResponse> {
    return ApiClient.get<AnalyticsSpendingResponse>('/analytics/spending/current-month');
  }

  static async getSpendingTotal(
    startDate?: string,
    endDate?: string,
    accountIds?: string[]
  ): Promise<number> {
    let endpoint = '/analytics/spending';
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    appendAccountQueryParams(params, accountIds);
    const qs = params.toString();
    if (qs) endpoint += `?${qs}`;
    const result = await ApiClient.get<number | string>(endpoint);
    return typeof result === 'number' ? result : Number(result);
  }

  static async getCategorySpendingByDateRange(
    startDate?: string,
    endDate?: string,
    accountIds?: string[]
  ): Promise<AnalyticsCategoryResponse[]> {
    let endpoint = '/analytics/categories';
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    appendAccountQueryParams(params, accountIds);
    const qs = params.toString();
    if (qs) endpoint += `?${qs}`;
    return ApiClient.get<AnalyticsCategoryResponse[]>(endpoint);
  }

  static async getMonthlyTotals(
    months: number,
    accountIds?: string[]
  ): Promise<AnalyticsMonthlyTotalsResponse[]> {
    let endpoint = `/analytics/monthly-totals?months=${months}`;
    const params = new URLSearchParams(`months=${months}`);
    appendAccountQueryParams(params, accountIds);
    const qs = params.toString();
    if (qs) endpoint = `/analytics/monthly-totals?${qs}`;
    return ApiClient.get<AnalyticsMonthlyTotalsResponse[]>(endpoint);
  }

  static async getCashFlow(
    months: number,
    accountIds?: string[]
  ): Promise<AnalyticsCashFlowResponse> {
    let endpoint = `/analytics/cash-flow?months=${months}`;
    const params = new URLSearchParams(`months=${months}`);
    appendAccountQueryParams(params, accountIds);
    const qs = params.toString();
    if (qs) endpoint = `/analytics/cash-flow?${qs}`;
    return ApiClient.get<AnalyticsCashFlowResponse>(endpoint);
  }

  static async getTopMerchantsByDateRange(
    startDate?: string,
    endDate?: string,
    accountIds?: string[]
  ): Promise<AnalyticsTopMerchantsResponse[]> {
    let endpoint = '/analytics/top-merchants';
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    appendAccountQueryParams(params, accountIds);
    const qs = params.toString();
    if (qs) endpoint += `?${qs}`;
    return ApiClient.get<AnalyticsTopMerchantsResponse[]>(endpoint);
  }

  static async getBalancesOverview(accountIds?: string[]): Promise<BalancesOverview> {
    let endpoint = '/analytics/balances/overview';
    const params = new URLSearchParams();
    appendAccountQueryParams(params, accountIds);
    const qs = params.toString();
    if (qs) endpoint += `?${qs}`;
    return ApiClient.get<BalancesOverview>(endpoint);
  }

  static async getNetWorthOverTime(
    startDate: string,
    endDate: string,
    accountIds?: string[]
  ): Promise<{ date: string; value: number }[]> {
    let endpoint = '/analytics/net-worth-over-time';
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    appendAccountQueryParams(params, accountIds);
    endpoint += `?${params.toString()}`;
    const result = await ApiClient.get<{
      series: { date: string; value: number }[];
      currency: string;
    }>(endpoint);
    return result.series || [];
  }
}

export function computeRatio(positivesTotal: number, negativesTotal: number): number | null {
  if (negativesTotal === 0) return null;
  const denom = Math.max(1, Math.abs(negativesTotal));
  const ratio = positivesTotal / denom;
  return Math.round(ratio * 100) / 100;
}

export function formatRatio(ratio: number | string | null): string {
  if (ratio === null || ratio === undefined) return '∞';
  const n = typeof ratio === 'string' ? Number(ratio) : ratio;
  if (!Number.isFinite(n)) return '∞';
  return n.toFixed(2);
}
