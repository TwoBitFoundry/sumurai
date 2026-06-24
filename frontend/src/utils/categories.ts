/**
 * Helpers for working with transaction categories.
 */

import type { CustomCategory } from '@/types/api';
import type { CategoryTheme } from '@/ui/tokens';
import { getCategoryAccent, getCategoryAccentByIndex, getCategoryAccentByKey } from '@/ui/tokens';

const SYSTEM_CATEGORY_LABELS: Record<string, string> = {
  BANK_FEES: 'Bank Fees',
  ENTERTAINMENT: 'Entertainment',
  FOOD_AND_DRINK: 'Food & Drink',
  GENERAL_MERCHANDISE: 'Merchandise',
  GENERAL_SERVICES: 'Services',
  GOVERNMENT_AND_NON_PROFIT: 'Govt & Non Profit',
  HOME_IMPROVEMENT: 'Home',
  INCOME: 'Income',
  LOAN_PAYMENTS: 'Loan Payments',
  MEDICAL: 'Medical',
  OTHER: 'Other',
  PERSONAL_CARE: 'Personal Care',
  RENT_AND_UTILITIES: 'Bills',
  SHOPPING: 'Shopping',
  SUBSCRIPTION: 'Subscriptions',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  TRANSPORTATION: 'Transport',
  TRAVEL: 'Travel',
};

export const SYSTEM_CATEGORY_SLUGS = [
  'BANK_FEES',
  'ENTERTAINMENT',
  'FOOD_AND_DRINK',
  'GENERAL_MERCHANDISE',
  'GENERAL_SERVICES',
  'GOVERNMENT_AND_NON_PROFIT',
  'HOME_IMPROVEMENT',
  'INCOME',
  'LOAN_PAYMENTS',
  'MEDICAL',
  'OTHER',
  'PERSONAL_CARE',
  'RENT_AND_UTILITIES',
  'SHOPPING',
  'SUBSCRIPTION',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'TRANSPORTATION',
  'TRAVEL',
] as const;

export function formatCategoryName(categoryPrimary: string | undefined | null): string {
  if (!categoryPrimary) return 'Other';
  const key = categoryPrimary.trim().replace(/\s+/g, '_').toUpperCase();
  const override = SYSTEM_CATEGORY_LABELS[key];
  if (override) {
    return override;
  }
  return categoryPrimary
    .trim()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function longestFormattedCategoryLabel(
  names: readonly string[] = SYSTEM_CATEGORY_SLUGS
): string {
  return names.reduce((longest, name) => {
    const label = formatCategoryName(name);
    return label.length > longest.length ? label : longest;
  }, '');
}

export function mobileCategoryChipWidthRem(longestLabel: string): string {
  const contentRem = longestLabel.length * 0.48;
  const chromeRem = 1.65;
  const chevronRem = 1.25;
  return `${(contentRem + chromeRem + chevronRem).toFixed(2)}rem`;
}

export function sortCategoryNamesAlphabetically(names: string[]): string[] {
  return [...names].sort((a, b) =>
    formatCategoryName(a).localeCompare(formatCategoryName(b), undefined, { sensitivity: 'base' })
  );
}

export function mergeTransactionFilterCategories(
  transactionCategories: string[],
  customCategories: CustomCategory[]
): string[] {
  const customNames = customCategories.map((category) => category.display_name);
  return sortCategoryNamesAlphabetically([...new Set([...transactionCategories, ...customNames])]);
}

function toCategorySlug(value: string): string {
  return value.trim().replace(/\s+/g, '_').toUpperCase();
}

function isIncomeCategorySlug(slug: string): boolean {
  return slug === 'INCOME' || slug.startsWith('INCOME_');
}

function isTransferOutCategorySlug(slug: string): boolean {
  return slug === 'TRANSFER_OUT' || slug.startsWith('TRANSFER_OUT_');
}

const SYSTEM_CATEGORY_ACCENT_KEYS: Record<string, string> = {
  BANK_FEES: 'slate',
  RENT_AND_UTILITIES: 'sky',
  ENTERTAINMENT: 'violet',
  FOOD_AND_DRINK: 'amber',
  GOVERNMENT_AND_NON_PROFIT: 'indigo',
  HOME_IMPROVEMENT: 'lime',
  LOAN_PAYMENTS: 'coral',
  GENERAL_MERCHANDISE: 'fuchsia',
  MEDICAL: 'teal',
  OTHER: 'slate',
  PERSONAL_CARE: 'pink',
  SHOPPING: 'orange',
  GENERAL_SERVICES: 'cyan',
  SUBSCRIPTION: 'indigo',
  TRANSFER_IN: 'mint',
  TRANSPORTATION: 'cyan',
  TRAVEL: 'sky',
};

export function getSystemCategoryAccentKey(name: string): string | null {
  const slug = toCategorySlug(name);
  const direct = SYSTEM_CATEGORY_ACCENT_KEYS[slug];
  if (direct) {
    return direct;
  }

  const display = formatCategoryName(name).toLowerCase();
  for (const systemSlug of SYSTEM_CATEGORY_SLUGS) {
    if (toCategorySlug(systemSlug) === slug) {
      return SYSTEM_CATEGORY_ACCENT_KEYS[systemSlug] ?? null;
    }
    const systemDisplay = (
      SYSTEM_CATEGORY_LABELS[systemSlug] ?? formatCategoryName(systemSlug)
    ).toLowerCase();
    if (systemDisplay === display) {
      return SYSTEM_CATEGORY_ACCENT_KEYS[systemSlug] ?? null;
    }
  }

  return null;
}

export function getReservedCategoryAccent(name: string): CategoryTheme | null {
  const slug = toCategorySlug(name);
  if (isIncomeCategorySlug(slug)) {
    return getCategoryAccentByKey('emerald');
  }
  if (isTransferOutCategorySlug(slug)) {
    return getCategoryAccentByKey('rose');
  }
  return null;
}

export function buildCategoryAccentIndex(names: readonly string[]): ReadonlyMap<string, number> {
  let rotationIndex = 0;
  const map = new Map<string, number>();
  for (const name of names) {
    if (getReservedCategoryAccent(name)) {
      continue;
    }
    map.set(name, rotationIndex);
    rotationIndex += 1;
  }
  return map;
}

const BUDGET_INELIGIBLE_CATEGORY_SLUGS = new Set(['INCOME', 'TRANSFER_IN', 'TRANSFER_OUT']);

export function isBudgetIneligibleCategory(category: string | undefined | null): boolean {
  if (!category) {
    return false;
  }
  const slug = toCategorySlug(category);
  if (BUDGET_INELIGIBLE_CATEGORY_SLUGS.has(slug)) {
    return true;
  }
  return slug.startsWith('TRANSFER_IN_') || slug.startsWith('TRANSFER_OUT_');
}

export function isBudgetEligibleCategory(category: string | undefined | null): boolean {
  return !isBudgetIneligibleCategory(category);
}

function findCategoryAccentIndex(
  name: string,
  accentIndex: ReadonlyMap<string, number>
): number | undefined {
  const direct = accentIndex.get(name);
  if (direct !== undefined) {
    return direct;
  }

  const trimmed = name.trim();
  const slug = toCategorySlug(trimmed);
  const display = formatCategoryName(trimmed).toLowerCase();

  for (const [key, index] of accentIndex.entries()) {
    if (key.trim().toLowerCase() === trimmed.toLowerCase()) {
      return index;
    }
    if (toCategorySlug(key) === slug) {
      return index;
    }
    if (formatCategoryName(key).toLowerCase() === display) {
      return index;
    }
  }

  return undefined;
}

export function getTagThemeForCategory(
  name?: string | null,
  accentIndex?: ReadonlyMap<string, number>
) {
  if (name != null) {
    const reserved = getReservedCategoryAccent(name);
    if (reserved) {
      return reserved;
    }
    const systemKey = getSystemCategoryAccentKey(name);
    if (systemKey) {
      return getCategoryAccentByKey(systemKey);
    }
  }
  if (accentIndex && name != null) {
    const index = findCategoryAccentIndex(name, accentIndex);
    if (index !== undefined) {
      return getCategoryAccentByIndex(index);
    }
  }
  return getCategoryAccent(name);
}

export function getTagThemeForCategoryAtIndex(index: number) {
  return getCategoryAccentByIndex(index);
}

export function categoryLookupKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => (word.endsWith('s') ? word.slice(0, -1) : word))
    .join(' ');
}

export function formatCustomCategoryDisplay(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export type ValidateCustomCategoryNameError =
  | 'too_long'
  | 'too_many_words'
  | 'empty'
  | 'invalid_characters'
  | 'collides_system'
  | 'collides_custom';

export interface ValidateCustomCategoryNameResult {
  ok: boolean;
  display?: string;
  code?: ValidateCustomCategoryNameError;
}

export function validateCustomCategoryName(
  raw: string,
  existing: { system: string[]; custom: CustomCategory[] }
): ValidateCustomCategoryNameResult {
  if (!raw || !raw.trim()) {
    return { ok: false, code: 'empty' };
  }

  if (!/^[a-zA-Z\s]+$/.test(raw)) {
    return { ok: false, code: 'invalid_characters' };
  }

  const display = formatCustomCategoryDisplay(raw);
  const trimmed = raw.trim();

  if (trimmed.length > 30) {
    return { ok: false, code: 'too_long' };
  }

  const words = trimmed.split(/\s+/);
  if (words.length > 3) {
    return { ok: false, code: 'too_many_words' };
  }

  const lookupKey = categoryLookupKey(raw);

  for (const systemCategory of existing.system) {
    const systemLookup = systemCategory
      .toLowerCase()
      .split('_')
      .join(' ')
      .trim()
      .split(/\s+/)
      .map((word) => (word.endsWith('s') ? word.slice(0, -1) : word))
      .join(' ');
    if (lookupKey === systemLookup) {
      return { ok: false, code: 'collides_system' };
    }

    const displayLookup = categoryLookupKey(formatCategoryName(systemCategory));
    if (lookupKey === displayLookup) {
      return { ok: false, code: 'collides_system' };
    }
  }

  for (const customCategory of existing.custom) {
    const customLookup = categoryLookupKey(customCategory.display_name);
    if (lookupKey === customLookup) {
      return { ok: false, code: 'collides_custom' };
    }
  }

  return { ok: true, display };
}
