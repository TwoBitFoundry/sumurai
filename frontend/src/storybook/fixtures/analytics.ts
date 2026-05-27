import type { DonutDatum } from '@/features/analytics/adapters/chartData';
import type { AnalyticsTopMerchantsResponse } from '@/types/api';

export const sampleDonutByCategory: DonutDatum[] = [
  { name: 'Food', categoryKey: 'food_and_drink', value: 420 },
  { name: 'Transit', categoryKey: 'transportation', value: 188 },
  { name: 'Income', categoryKey: 'income', value: 3100 },
  { name: 'Shopping', categoryKey: 'shopping', value: 240 },
];

export const sampleDonutTotal = sampleDonutByCategory.reduce((s, d) => s + d.value, 0);

export const sampleTopMerchants: AnalyticsTopMerchantsResponse[] = [
  { name: 'Corner Market', amount: 412.5, count: 14, percentage: 22 },
  { name: 'Transit Authority', amount: 188.0, count: 28, percentage: 10 },
  { name: 'Employer Payroll', amount: 3100.0, count: 2, percentage: 44 },
  { name: 'Regional Utility Co', amount: 96.2, count: 3, percentage: 5 },
  { name: 'Coffee Collective Wholesale Roasters Group', amount: 72.4, count: 11, percentage: 4 },
];
