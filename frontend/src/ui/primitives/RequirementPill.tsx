import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { designTokens } from '@/ui/tokens';
import { cn } from './utils';

const requirementVariants = cva(
  [
    designTokens.typography.badge,
    'inline-flex items-center rounded-full px-2.5 py-1 transition-colors duration-200',
  ],
  {
    variants: {
      status: {
        pending: [...designTokens.surfaces.semantic.mutedChip, designTokens.text.subtle].join(' '),
        met: [...designTokens.status.success.surface, ...designTokens.status.success.text].join(
          ' '
        ),
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
