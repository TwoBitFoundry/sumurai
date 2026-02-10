import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from './utils';

const alertVariants = cva(
  [
    'relative flex gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm',
    'transition-colors duration-300',
  ],
  {
    variants: {
      variant: {
        info: [
          'border-sky-200/70 bg-sky-50/80 text-sky-700',
          'dark:border-sky-500/30 dark:bg-sky-900/20 dark:text-sky-300',
        ],
        success: [
          'border-emerald-200/70 bg-emerald-50/85 text-emerald-700',
          'dark:border-emerald-500/35 dark:bg-emerald-900/20 dark:text-emerald-300',
        ],
        warning: [
          'border-amber-200/70 bg-amber-50/80 text-amber-700',
          'dark:border-amber-500/35 dark:bg-amber-900/25 dark:text-amber-300',
        ],
        error: [
          'border-red-200/70 bg-red-50/80 text-red-700',
          'dark:border-red-600/45 dark:bg-red-900/25 dark:text-red-300',
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
          <p
            className={cn(
              'text-xs',
              'font-semibold',
              'uppercase',
              'tracking-[0.24em]',
              'opacity-85'
            )}
          >
            {title}
          </p>
        )}
        <div className={cn('text-sm', 'leading-relaxed')}>{children}</div>
      </div>
    </div>
  );
}

export default Alert;
