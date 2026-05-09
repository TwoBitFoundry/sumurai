import { getCategoryAccent } from '@/ui/tokens-runtime';

export function formatCategoryName(categoryPrimary: string | undefined | null): string {
  if (!categoryPrimary) return 'Other';
  return categoryPrimary
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getTagThemeForCategory(name?: string | null) {
  return getCategoryAccent(name);
}
