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
        pending: `bg-white/60 ${designTokens.text.subtle} dark:bg-white/5`,
        met: `bg-emerald-50 ${designTokens.text.success} dark:bg-emerald-500/10`,
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
