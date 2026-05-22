/**
 * Helpers for working with transaction categories.
 */

import type { CustomCategory } from '@/types/api';
import { getCategoryAccent, getCategoryAccentByIndex } from '@/ui/tokens';

export function formatCategoryName(categoryPrimary: string | undefined | null): string {
  if (!categoryPrimary) return 'Other';
  return categoryPrimary
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function sortCategoryNamesAlphabetically(names: string[]): string[] {
  return [...names].sort((a, b) =>
    formatCategoryName(a).localeCompare(formatCategoryName(b), undefined, { sensitivity: 'base' })
  );
}

export function buildCategoryAccentIndex(names: readonly string[]): ReadonlyMap<string, number> {
  return new Map(names.map((name, index) => [name, index]));
}

export function getTagThemeForCategory(
  name?: string | null,
  accentIndex?: ReadonlyMap<string, number>
) {
  if (accentIndex && name != null) {
    const index = accentIndex.get(name);
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
  }

  for (const customCategory of existing.custom) {
    const customLookup = categoryLookupKey(customCategory.display_name);
    if (lookupKey === customLookup) {
      return { ok: false, code: 'collides_custom' };
    }
  }

  return { ok: true, display };
}
