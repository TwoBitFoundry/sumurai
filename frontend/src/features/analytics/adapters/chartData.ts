/**
 * Transforms analytics API results into chart-ready series.
 */

import type { AnalyticsTopMerchantsResponse } from '../../../types/api';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';

export type DonutDatum = {
  name: string;
  categoryKey: string;
  value: number;
  color?: string;
};

type CategoryDatum = {
  category?: string | null;
  name?: string | null;
  amount?: number | string | null;
  value?: number | string | null;
};

export function categoriesToDonut(
  categories: CategoryDatum[] = [],
  accentIndexByName?: ReadonlyMap<string, number>
): DonutDatum[] {
  const mapped = categories.map((c) => {
    const rawName: string = (c.category ?? c.name ?? 'Unknown') || 'Unknown';
    const displayName = formatCategoryName(rawName);
    const rawAmount: number | string | null | undefined = c.amount ?? c.value ?? 0;
    const value = typeof rawAmount === 'string' ? Number(rawAmount) : Number(rawAmount || 0);
    const theme = getTagThemeForCategory(rawName, accentIndexByName);
    return {
      name: displayName,
      categoryKey: rawName,
      value: Number.isFinite(value) ? value : 0,
      color: theme.ringHex,
    };
  });

  const positive = mapped.filter((d) => d.value > 0);
  positive.sort((a, b) => b.value - a.value);
  return positive;
}

export type MerchantItem = AnalyticsTopMerchantsResponse;

export function normalizeMerchants(items: AnalyticsTopMerchantsResponse[]): MerchantItem[] {
  return (items || []).slice().sort((a, b) => Number(b.amount) - Number(a.amount));
}
