import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { designTokens } from '@/ui/tokens';
import { cn } from './utils';

const badgeVariants = cva(
  [...designTokens.components.badge.base],
  {
    variants: {
      variant: {
        default: [...designTokens.components.badge.default],
        primary: [...designTokens.components.badge.primary],
        feature: [...designTokens.components.badge.feature],
      },
      size: {
        xs: 'px-2 py-0.5 text-[10px] tracking-[0.2em] rounded-md',
        sm: 'px-2.5 py-1 text-[11px] tracking-[0.24em] rounded-lg',
        md: 'px-3 py-1 text-xs tracking-[0.24em] rounded-full',
        lg: 'px-3.5 py-1.5 text-xs tracking-[0.3em] rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

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
