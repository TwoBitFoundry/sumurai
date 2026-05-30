import type React from 'react';
import { heroStatSemanticThemes } from '@/components/widgets/heroStatSemanticThemes';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { getTagThemeForCategory } from '@/utils/categories';
import { cn } from './utils';

export const pillRecipes = {
  base: `inline-flex w-fit max-w-full flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 ${uiTypographyRecipes.badge}`,
  dot: 'h-2 w-2 rounded-full shadow-[0_0_0_1px_var(--color-border-glass)] dark:shadow-[0_0_0_1px_var(--color-effect-glass-shadow)]',
  fadeLeft:
    'pointer-events-none absolute bottom-0 left-0 top-0 w-6 bg-gradient-to-r from-[var(--color-surface-card)] to-transparent transition-opacity duration-200 dark:from-[var(--color-surface-card)]',
  fadeRight:
    'pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-[var(--color-surface-card)] to-transparent transition-opacity duration-200 dark:from-[var(--color-surface-card)]',
} as const;

export const pillScrollFadeRecipes = {
  card: {
    left: pillRecipes.fadeLeft,
    right: pillRecipes.fadeRight,
  },
  glass: {
    left: 'pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_18%,transparent)] to-transparent transition-opacity duration-200 dark:from-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_55%,transparent)]',
    right:
      'pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_18%,transparent)] to-transparent transition-opacity duration-200 dark:from-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_55%,transparent)]',
  },
} as const;

export type PillVariant = 'category' | 'status' | 'dot';
export type PillTone = 'success' | 'info' | 'warning' | 'danger';

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  tone?: PillTone;
  categoryName?: string;
  accentIndexByName?: ReadonlyMap<string, number>;
  children: React.ReactNode;
}

const statusThemes = {
  success: heroStatSemanticThemes.success,
  info: heroStatSemanticThemes.info,
  warning: heroStatSemanticThemes.warning,
  danger: heroStatSemanticThemes.danger,
} as const;

export function Pill({
  variant = 'category',
  tone = 'info',
  categoryName,
  accentIndexByName,
  className,
  children,
  ...props
}: PillProps) {
  const base = pillRecipes.base;

  if (variant === 'status') {
    const theme = statusThemes[tone];
    return (
      <span className={cn(base, theme.wrapper, className)} {...props}>
        <span className="whitespace-nowrap">{children}</span>
      </span>
    );
  }

  if (variant === 'dot') {
    return (
      <span className={cn(base, uiTextRecipes.label, className)} {...props}>
        <span className={cn(pillRecipes.dot)} aria-hidden="true" />
        <span className="whitespace-nowrap">{children}</span>
      </span>
    );
  }

  const theme = getTagThemeForCategory(categoryName || String(children), accentIndexByName);
  return (
    <span className={cn(base, theme.tag, className)} {...props}>
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
}

export default Pill;
