import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
} from '@/ui/recipes';
import { cn } from './utils';

export const paginationButtonRecipes = [
  'inline-flex h-9 w-9 items-center justify-center rounded-full',
  ...semanticBorders.glass,
  ...semanticSurfaces.card,
  'text-slate-600 dark:text-slate-200',
  ...semanticEffects.glassShadow,
  'transition-all duration-200 hover:-translate-y-[2px] hover:bg-[var(--color-surface-hover-row)] dark:hover:bg-[var(--color-surface-hover-row)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
] as const;

const paginationButtonVariants = cva(paginationButtonRecipes.join(' '), {
  variants: {
    variant: {
      default: paginationButtonRecipes.join(' '),
      disabled: paginationButtonRecipes.join(' '),
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface PaginationButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof paginationButtonVariants> {
  children: React.ReactNode;
}

export function PaginationButton({
  variant,
  className,
  children,
  ...props
}: PaginationButtonProps) {
  return (
    <button
      type="button"
      className={cn(paginationButtonVariants({ variant }), className)}
      {...props}
    >
      {children}
    </button>
  );
}

export default PaginationButton;
