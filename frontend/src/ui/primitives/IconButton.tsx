import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  border as semanticBorders,
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
  radius as uiRadiusRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const iconButtonRecipes = {
  ghost: [
    `inline-flex items-center justify-center ${uiRadiusRecipes.standard} p-2`,
    ...semanticBorders.glass,
    ...semanticSurfaces.card,
    'text-slate-600 dark:text-slate-200',
    ...semanticEffects.glassShadow,
    'transition-transform duration-200 hover:-translate-y-[2px] hover:bg-[var(--color-surface-hover-row)] dark:hover:bg-[var(--color-surface-hover-row)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]',
  ],
  success: [
    `inline-flex items-center justify-center ${uiRadiusRecipes.standard} bg-gradient-to-r from-[var(--color-brand-emerald)] via-[var(--color-brand-emerald)] to-[var(--color-brand-sky)] p-2 text-white`,
    ...semanticEffects.successGlow,
    'transition-transform duration-200 hover:-translate-y-[2px]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    'dark:focus-visible:ring-offset-[#0f172a]',
  ],
  danger: [
    `inline-flex items-center justify-center ${uiRadiusRecipes.standard} border p-2`,
    ...semanticStatus.danger.border,
    ...semanticStatus.danger.surface,
    ...semanticStatus.danger.text,
    'shadow-sm',
    'transition-transform duration-200 hover:-translate-y-[2px] hover:bg-[var(--color-status-danger-strong-surface)] dark:hover:bg-[var(--color-status-danger-strong-surface)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-danger)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-[var(--color-border-danger)] dark:focus-visible:ring-offset-[#0f172a]',
  ],
} as const;

const iconButtonVariants = cva(iconButtonRecipes.ghost.join(' '), {
  variants: {
    variant: {
      ghost: iconButtonRecipes.ghost.join(' '),
      success: iconButtonRecipes.success.join(' '),
      danger: iconButtonRecipes.danger.join(' '),
    },
  },
  defaultVariants: {
    variant: 'ghost',
  },
});

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  children: React.ReactNode;
}

export function IconButton({ variant, className, children, ...props }: IconButtonProps) {
  return (
    <button type="button" className={cn(iconButtonVariants({ variant }), className)} {...props}>
      {children}
    </button>
  );
}

export default IconButton;
