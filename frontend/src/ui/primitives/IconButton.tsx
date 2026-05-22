import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  buttonChrome,
  chromeBar,
  control,
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
  successCta,
  radius as uiRadiusRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const iconButtonRecipes = {
  ghost: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} disabled:cursor-not-allowed`,
    ...buttonChrome.muted,
    ...semanticSurfaces.card,
    'text-slate-600 dark:text-slate-200',
    ...semanticEffects.glassShadow,
    'transition-all duration-200 ease-out hover:-translate-y-[2px] hover:bg-[var(--color-surface-hover-row)] active:scale-[0.98] disabled:active:scale-100 dark:hover:bg-[var(--color-surface-hover-row)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]',
  ],
  primary: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500 text-white disabled:cursor-not-allowed`,
    'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)]',
    'transition-all duration-200 ease-out hover:-translate-y-[2px] active:scale-[0.98] disabled:active:scale-100 disabled:hover:translate-y-0',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-[#0f172a]',
  ],
  success: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} text-white disabled:cursor-not-allowed`,
    ...successCta.gradient,
    ...semanticEffects.successGlow,
    'transition-all duration-200 ease-out',
    ...successCta.hover,
    ...successCta.focus,
  ],
  danger: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} disabled:cursor-not-allowed`,
    'border',
    ...semanticStatus.danger.border,
    ...semanticStatus.danger.surface,
    ...semanticStatus.danger.text,
    ...semanticEffects.glassShadow,
    'transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] disabled:active:scale-100 disabled:hover:translate-y-0',
    'hover:bg-[var(--color-status-danger-strong-surface)]',
    'dark:hover:bg-[color:color-mix(in_srgb,var(--color-status-danger-strong-surface)_46%,transparent)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-status-danger-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-[var(--color-status-danger-border)] dark:focus-visible:ring-offset-slate-900',
  ],
} as const;

const iconButtonVariants = cva('', {
  variants: {
    variant: {
      ghost: iconButtonRecipes.ghost.join(' '),
      primary: iconButtonRecipes.primary.join(' '),
      success: iconButtonRecipes.success.join(' '),
      danger: iconButtonRecipes.danger.join(' '),
    },
    size: {
      sm: control.square.sm,
      md: control.square.md,
      lg: control.square.lg,
      bar: `${chromeBar.square} p-0`,
    },
  },
  defaultVariants: {
    variant: 'ghost',
    size: 'md',
  },
});

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  children: React.ReactNode;
}

export function IconButton({
  variant,
  size,
  className,
  children,
  ref,
  ...props
}: IconButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) {
  const resolvedSize = size ?? 'md';
  const glyphShellClass =
    resolvedSize === 'bar'
      ? cn(chromeBar.glyphWell, '[&_svg]:block', '[&_svg]:h-full', '[&_svg]:w-full')
      : cn(
          'inline-flex',
          'shrink-0',
          'items-center',
          'justify-center',
          control.glyph[resolvedSize],
          '[&_svg]:block',
          '[&_svg]:h-full',
          '[&_svg]:w-full'
        );

  return (
    <button
      ref={ref}
      type="button"
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      <span className={glyphShellClass}>{children}</span>
    </button>
  );
}

export default IconButton;
