import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { cn } from './utils';

const requirementVariants = cva(
  [
    uiTypographyRecipes.badge,
    'inline-flex items-center rounded-full px-2.5 py-1 transition-colors duration-200',
  ],
  {
    variants: {
      status: {
        pending: [
          'bg-[color:color-mix(in_srgb,var(--color-surface-card)_60%,transparent)]',
          'dark:bg-[color:color-mix(in_srgb,var(--color-border-glass)_5%,transparent)]',
          uiTextRecipes.subtle,
        ].join(' '),
        met: [
          'bg-[color:color-mix(in_srgb,var(--color-status-success-surface)_70%,transparent)]',
          'dark:bg-[color:color-mix(in_srgb,var(--color-status-success-icon)_10%,transparent)]',
          uiTextRecipes.success,
        ].join(' '),
      },
    },
    defaultVariants: {
      status: 'pending',
    },
  }
);

export interface RequirementPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof requirementVariants> {
  children: React.ReactNode;
}

export function RequirementPill({ status, className, children, ...props }: RequirementPillProps) {
  return (
    <span className={cn(requirementVariants({ status }), className)} {...props}>
      {children}
    </span>
  );
}

export default RequirementPill;
