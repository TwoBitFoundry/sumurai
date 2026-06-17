import { AnalyticsService } from '@/services/AnalyticsService';
import { ApiClient } from '@/services/ApiClient';
import type {
  AnalyticsCategoryResponse,
  AnalyticsMonthlyTotalsResponse,
  AnalyticsTopMerchantsResponse,
  BudgetSummaryResponse,
  IncomeExpenseTotalsResponse,
} from '@/types/api';

jest.mock('@/services/ApiClient', () => ({
  ApiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    configure: jest.fn(),
  },
}));

describe('AnalyticsService (date-range endpoints)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSpendingTotal', () => {
    it('calls backend with start/end date for current month', async () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const start = new Date(y, m, 1).toISOString().slice(0, 10);
      const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      jest.mocked(ApiClient.get).mockResolvedValue(1250.75);

      const result = await AnalyticsService.getSpendingTotal(start, end);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/spending?start_date=${start}&end_date=${end}`
      );
      expect(result).toBe(1250.75);
    });

    it('omits query params for all-time (no dates)', async () => {
      jest.mocked(ApiClient.get).mockResolvedValue(0);

      const result = await AnalyticsService.getSpendingTotal();

      expect(ApiClient.get).toHaveBeenCalledWith('/analytics/spending');
      expect(result).toBe(0);
    });

    it('serializes account_ids parameter when provided', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const accountIds = ['acc_1', 'acc_2'];
      jest.mocked(ApiClient.get).mockResolvedValue(500.25);

      const result = await AnalyticsService.getSpendingTotal(start, end, accountIds);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/spending?start_date=${start}&end_date=${end}&account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2`
      );
      expect(result).toBe(500.25);
    });
  });

  describe('getCategorySpendingByDateRange', () => {
    it('calls backend with date range for categories', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const mockCategories: AnalyticsCategoryResponse[] = [
        { category: 'Food & Dining', amount: 450.25, percentage: 36.02 },
        { category: 'Transportation', amount: 280.5, percentage: 22.44 },
      ];
      jest.mocked(ApiClient.get).mockResolvedValue(mockCategories);

      const result = await AnalyticsService.getCategorySpendingByDateRange(start, end);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/categories?start_date=${start}&end_date=${end}`
      );
      expect(result).toEqual(mockCategories);
    });

    it('omits query params when no dates are provided (all-time)', async () => {
      const mockCategories: AnalyticsCategoryResponse[] = [];
      jest.mocked(ApiClient.get).mockResolvedValue(mockCategories);

      const result = await AnalyticsService.getCategorySpendingByDateRange();

      expect(ApiClient.get).toHaveBeenCalledWith('/analytics/categories');
      expect(result).toEqual(mockCategories);
    });

    it('serializes account_ids parameter when provided', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const accountIds = ['acc_1', 'acc_2'];
      const mockCategories: AnalyticsCategoryResponse[] = [
        { category: 'Food & Dining', amount: 250.25, percentage: 50.05 },
      ];
      jest.mocked(ApiClient.get).mockResolvedValue(mockCategories);

      const result = await AnalyticsService.getCategorySpendingByDateRange(start, end, accountIds);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/categories?start_date=${start}&end_date=${end}&account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2`
      );
      expect(result).toEqual(mockCategories);
    });
  });

  describe('getIncomeExpenseTotals', () => {
    it('calls backend with date range for income and expense totals', async () => {
      const start = '2024-01-01';
      const end = '2024-12-31';
      const mockTotals: IncomeExpenseTotalsResponse = {
        income: 5000,
        expenses: 1200,
      };
      jest.mocked(ApiClient.get).mockResolvedValue(mockTotals);

      const result = await AnalyticsService.getIncomeExpenseTotals(start, end);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/income-expense-totals?start_date=${start}&end_date=${end}`
      );
      expect(result).toEqual(mockTotals);
    });

    it('serializes account_ids parameter when provided', async () => {
      const start = '2024-01-01';
      const end = '2024-12-31';
      const accountIds = ['acc_1', 'acc_2'];
      const mockTotals: IncomeExpenseTotalsResponse = {
        income: 5000,
        expenses: 1200,
      };
      jest.mocked(ApiClient.get).mockResolvedValue(mockTotals);

      const result = await AnalyticsService.getIncomeExpenseTotals(start, end, accountIds);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/income-expense-totals?start_date=${start}&end_date=${end}&account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2`
      );
      expect(result).toEqual(mockTotals);
    });
  });

  describe('getBudgetSummary', () => {
    it('calls backend with date range for budget summary', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const mockSummary: BudgetSummaryResponse = {
        income: 5000,
        category_spending: [{ name: 'FOOD_AND_DRINK', value: 125.5 }],
      };
      jest.mocked(ApiClient.get).mockResolvedValue(mockSummary);

      const result = await AnalyticsService.getBudgetSummary(start, end);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/budget-summary?start_date=${start}&end_date=${end}`
      );
      expect(result).toEqual(mockSummary);
    });

    it('serializes account_ids parameter when provided', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const accountIds = ['acc_1', 'acc_2'];
      const mockSummary: BudgetSummaryResponse = {
        income: 5000,
        category_spending: [{ name: 'FOOD_AND_DRINK', value: 125.5 }],
      };
      jest.mocked(ApiClient.get).mockResolvedValue(mockSummary);

      const result = await AnalyticsService.getBudgetSummary(start, end, accountIds);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/budget-summary?start_date=${start}&end_date=${end}&account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2`
      );
      expect(result).toEqual(mockSummary);
    });
  });

  // Removed daily spending endpoint and related UI

  describe('getMonthlyTotals', () => {
    it('should call backend for pre-calculated monthly totals', async () => {
      const mockMonthlyTotals: AnalyticsMonthlyTotalsResponse[] = [
        { month: '2024-01', amount: 1250.75 },
        { month: '2023-12', amount: 980.25 },
        { month: '2023-11', amount: 1100.0 },
      ];
      jest.mocked(ApiClient.get).mockResolvedValue(mockMonthlyTotals);

      const result = await AnalyticsService.getMonthlyTotals(3);

      expect(ApiClient.get).toHaveBeenCalledWith('/analytics/monthly-totals?months=3');
      expect(result).toEqual(mockMonthlyTotals);
    });

    it('should NOT perform any date calculations or processing', async () => {
      const backendTotals: AnalyticsMonthlyTotalsResponse[] = [
        { month: 'Dec 2023', amount: 500 },
        { month: '2024-01', amount: 1000 },
        { month: 'invalid-date', amount: 250 },
      ];
      jest.mocked(ApiClient.get).mockResolvedValue(backendTotals);

      const result = await AnalyticsService.getMonthlyTotals(6);

      expect(result).toEqual(backendTotals);
      expect(result[0].month).toBe('Dec 2023');
      expect(result[2].month).toBe('invalid-date');
    });
  });

  describe('getCashFlow', () => {
    it('serializes account_ids parameter when provided', async () => {
      const accountIds = ['acc_1', 'acc_2'];
      jest.mocked(ApiClient.get).mockResolvedValue({ series: [], currency: 'USD' });

      await AnalyticsService.getCashFlow(6, accountIds);

      expect(ApiClient.get).toHaveBeenCalledWith(
        '/analytics/cash-flow?months=6&account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2'
      );
    });
  });

  describe('getTopMerchantsByDateRange', () => {
    it('calls backend with date range for top merchants', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const mockMerchants: AnalyticsTopMerchantsResponse[] = [
        { name: 'Starbucks', amount: 125.5, count: 8, percentage: 25.2 },
        { name: 'Shell', amount: 89.25, count: 4, percentage: 18.0 },
      ];
      jest.mocked(ApiClient.get).mockResolvedValue(mockMerchants);

      const result = await AnalyticsService.getTopMerchantsByDateRange(start, end);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/top-merchants?start_date=${start}&end_date=${end}`
      );
      expect(result).toEqual(mockMerchants);
    });
  });

  describe('getSankey', () => {
    it('calls backend with date range and account filter', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const accountIds = ['acc_1', 'acc_2'];
      const mockResponse = {
        nodes: [],
        links: [],
        currency: 'USD',
        summary: {
          income: '500.00',
          expenses: '200.00',
          covered: '200.00',
          deficit: '0.00',
          surplus: '300.00',
          coverage_ratio: '1.00',
        },
      };
      jest.mocked(ApiClient.get).mockResolvedValue(mockResponse as any);

      const result = await AnalyticsService.getSankey(start, end, accountIds);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/analytics/sankey?start_date=${start}&end_date=${end}&account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2`
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // Removed day-of-week spending endpoint and related UI

  describe('Pure Date Range API (no periods)', () => {
    it('should not have dateRangeToPeriod method', () => {
      expect((AnalyticsService as any).dateRangeToPeriod).toBeUndefined();
    });

    it('should call backend directly with date ranges for categories', async () => {
      const mockCategories: AnalyticsCategoryResponse[] = [
        { category: 'Food', amount: 100, percentage: 100 },
      ];
      jest.mocked(ApiClient.get).mockResolvedValue(mockCategories);

      const result = await AnalyticsService.getCategorySpendingByDateRange(
        '2024-01-01',
        '2024-01-31'
      );

      expect(ApiClient.get).toHaveBeenCalledWith(
        '/analytics/categories?start_date=2024-01-01&end_date=2024-01-31'
      );
      expect(result).toEqual(mockCategories);
    });

    it('should call backend directly with date ranges for merchants', async () => {
      const mockMerchants: AnalyticsTopMerchantsResponse[] = [
        { name: 'Store', amount: 100, count: 1, percentage: 100 },
      ];
      jest.mocked(ApiClient.get).mockResolvedValue(mockMerchants);

      const result = await AnalyticsService.getTopMerchantsByDateRange('2024-01-01', '2024-01-31');

      expect(ApiClient.get).toHaveBeenCalledWith(
        '/analytics/top-merchants?start_date=2024-01-01&end_date=2024-01-31'
      );
      expect(result).toEqual(mockMerchants);
    });

    // Day-of-week endpoint removed
  });
});
