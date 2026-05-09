import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { designTokens } from '@/ui/tokens';
import { cn } from './utils';

const alertVariants = cva(
  ['relative flex gap-3 rounded-2xl border px-4 py-3 shadow-sm', 'transition-colors duration-300'],
  {
    variants: {
      variant: {
        info: [
          ...designTokens.status.info.border,
          ...designTokens.status.info.surface,
          ...designTokens.status.info.text,
        ],
        success: [
          ...designTokens.status.success.border,
          ...designTokens.status.success.surface,
          ...designTokens.status.success.text,
        ],
        warning: [
          ...designTokens.status.warning.border,
          ...designTokens.status.warning.surface,
          ...designTokens.status.warning.text,
        ],
        error: [
          ...designTokens.status.danger.border,
          ...designTokens.status.danger.surface,
          ...designTokens.status.danger.text,
        ],
      },
      tone: {
        solid: 'backdrop-blur-sm backdrop-saturate-[140%]',
        subtle: 'backdrop-blur-xs backdrop-saturate-[120%]',
      },
    },
    defaultVariants: {
      variant: 'info',
      tone: 'solid',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Alert({ variant, tone, title, icon, className, children, ...props }: AlertProps) {
  return (
    <div className={cn(alertVariants({ variant, tone }), className)} {...props}>
      {icon && <span className={cn('mt-0.5', 'text-lg')}>{icon}</span>}
      <div className="space-y-1">
        {title && (
          <p className={cn(designTokens.typography.captionStrong, 'opacity-85')}>{title}</p>
        )}
        <div className={cn(designTokens.typography.body)}>{children}</div>
      </div>
    </div>
  );
}

export default Alert;
