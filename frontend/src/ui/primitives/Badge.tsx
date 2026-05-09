import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { designTokens } from '@/ui/tokens';
import { primitiveTokenRecipes } from './recipes';
import { cn } from './utils';

export const badgeSizeStyles = {
  xs: 'px-2 py-0.5 rounded-md',
  sm: 'px-2.5 py-1 rounded-lg',
  md: 'px-3 py-1 rounded-full',
  lg: 'px-3.5 py-1.5 rounded-full',
} as const;

const badgeVariants = cva([...primitiveTokenRecipes.badge.base], {
  variants: {
    variant: {
      default: [...primitiveTokenRecipes.badge.default],
      primary: [...primitiveTokenRecipes.badge.primary],
      feature: [...primitiveTokenRecipes.badge.feature],
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
