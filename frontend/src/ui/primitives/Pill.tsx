import type React from 'react';
import { designTokens } from '@/ui/tokens';
import { getTagThemeForCategory } from '@/utils/categories';
import { heroStatCard, pill as pillRecipes } from './recipes';
import { cn } from './utils';

export type PillVariant = 'category' | 'status' | 'dot';
export type PillTone = 'success' | 'info' | 'warning' | 'danger';

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  tone?: PillTone;
  categoryName?: string;
  children: React.ReactNode;
}

const statusThemes = {
  success: heroStatCard.semantic.success,
  info: heroStatCard.semantic.info,
  warning: heroStatCard.semantic.warning,
  danger: heroStatCard.semantic.danger,
} as const;

export function Pill({
  variant = 'category',
  tone = 'info',
  categoryName,
  className,
  children,
  ...props
}: PillProps) {
  const base = pillRecipes.base;
  const dot = pillRecipes.dot;

  if (variant === 'status') {
    const theme = statusThemes[tone];
    return (
      <span className={cn(base, theme.wrapper, className)} {...props}>
        <span className={cn(dot, theme.dot)} aria-hidden="true" />
        <span className="whitespace-nowrap">{children}</span>
      </span>
    );
  }

  if (variant === 'dot') {
    return (
      <span className={cn(base, designTokens.text.label, className)} {...props}>
        <span className={cn(dot)} aria-hidden="true" />
        <span className="whitespace-nowrap">{children}</span>
      </span>
    );
  }

  const theme = getTagThemeForCategory(categoryName || String(children));
  return (
    <span className={cn(base, theme.tag, className)} {...props}>
      <span className={cn(dot, theme.dot)} aria-hidden="true" />
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
}

export default Pill;
