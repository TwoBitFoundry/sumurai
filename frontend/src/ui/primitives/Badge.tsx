import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const badgeRecipes = {
  base: [
    'inline-flex items-center justify-center',
    uiTypographyRecipes.badge,
    'transition-all duration-200 ease-out',
  ],
  default: [
    ...semanticSurfaces.mutedChip,
    semanticTextRecipes.muted,
    ...semanticEffects.glassShadow,
    'dark:text-slate-200',
  ],
  primary: [...semanticStatus.info.surface, ...semanticStatus.info.text],
  feature: [...semanticSurfaces.insetWell, 'ring-1 ring-inset'],
} as const;

export const badgeSizeStyles = {
  xs: `px-2 py-0.5 ${uiRadiusRecipes.standard}`,
  sm: `px-2.5 py-1 ${uiRadiusRecipes.standard}`,
  md: 'px-3 py-1 rounded-full',
  lg: 'px-3.5 py-1.5 rounded-full',
} as const;

const badgeVariants = cva([...badgeRecipes.base], {
  variants: {
    variant: {
      default: [...badgeRecipes.default],
      primary: [...badgeRecipes.primary],
      feature: [...badgeRecipes.feature],
    },
    size: {
      xs: badgeSizeStyles.xs,
      sm: badgeSizeStyles.sm,
      md: badgeSizeStyles.md,
      lg: badgeSizeStyles.lg,
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
}

/**
 * Small status indicator with semantic colors.
 *
 * @example
 * ```tsx
 * <Badge variant="primary" size="sm">NEW</Badge>
 * <Badge variant="default" size="md">Status</Badge>
 * ```
 *
 * @see {@link ../README.md} for detailed variant documentation
 */
export function Badge({ variant, size, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {children}
    </span>
  );
}

export default Badge;
