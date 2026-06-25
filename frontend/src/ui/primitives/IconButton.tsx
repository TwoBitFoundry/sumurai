import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  brandNeutral,
  buttonChrome,
  buttonCta,
  chromeBar,
  control,
  dangerCta,
  surface as semanticSurfaces,
  successCta,
  radius as uiRadiusRecipes,
} from '@/ui/recipes';
import { buttonRecipes } from './Button';
import { ControlHoverLabel, resolveControlHoverLabel } from './ControlHoverLabel';
import { cn } from './utils';

export const iconButtonRecipes = {
  ghost: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} disabled:cursor-not-allowed`,
    ...buttonChrome.muted,
    ...semanticSurfaces.card,
    brandNeutral.textMuted,
    brandNeutral.controlTextDark,
    'transition-all duration-200 ease-out hover:-translate-y-[2px] hover:bg-[var(--color-surface-hover-row)] active:scale-[0.98] disabled:active:scale-100 dark:hover:bg-[var(--color-surface-hover-row)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-brand-fog)] dark:focus-visible:ring-offset-[var(--color-brand-navy)]',
  ],
  primary: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} bg-[var(--color-brand-azure)] text-white disabled:cursor-not-allowed`,
    ...buttonCta.glow,
    'transition-all duration-200 ease-out hover:-translate-y-[2px] active:scale-[0.98] disabled:active:scale-100 disabled:hover:translate-y-0',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-brand-fog)] dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-[var(--color-brand-navy)]',
  ],
  success: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} text-white disabled:cursor-not-allowed`,
    ...successCta.gradient,
    ...successCta.glow,
    'transition-all duration-200 ease-out',
    ...successCta.hover,
    ...successCta.focus,
  ],
  danger: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} disabled:cursor-not-allowed`,
    ...dangerCta.gradient,
    'text-white',
    'transition-all duration-200 ease-out active:scale-[0.98] disabled:active:scale-100',
    ...dangerCta.hover,
    ...dangerCta.focus,
  ],
  toolbar: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} disabled:cursor-not-allowed`,
    'border border-transparent',
    'bg-transparent',
    brandNeutral.textMuted,
    brandNeutral.controlTextDark,
    'transition-all duration-200 ease-out hover:-translate-y-[2px] active:scale-[0.98] disabled:active:scale-100 disabled:hover:translate-y-0',
    'hover:border-[var(--color-border-control)]',
    'hover:bg-[var(--color-surface-hover-row)]',
    'dark:hover:border-[var(--color-border-divider)]',
    'dark:hover:bg-[var(--color-surface-hover-row)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-brand-fog)] dark:focus-visible:ring-offset-[var(--color-brand-navy)]',
  ],
  tabActive: [
    `inline-flex cursor-pointer items-center justify-center ${uiRadiusRecipes.standard} disabled:cursor-not-allowed`,
    ...buttonRecipes.tabActive,
    'transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] disabled:active:scale-100 disabled:hover:translate-y-0',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-brand-fog)] dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-[var(--color-brand-navy)]',
  ],
} as const;

const iconButtonVariants = cva('', {
  variants: {
    variant: {
      ghost: iconButtonRecipes.ghost.join(' '),
      primary: iconButtonRecipes.primary.join(' '),
      success: iconButtonRecipes.success.join(' '),
      danger: iconButtonRecipes.danger.join(' '),
      toolbar: iconButtonRecipes.toolbar.join(' '),
      tabActive: iconButtonRecipes.tabActive.join(' '),
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
  title,
  disabled,
  ...props
}: IconButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) {
  const resolvedSize = size ?? 'md';
  const resolvedTitle = resolveControlHoverLabel(title, props['aria-label'], children);
  const isDisabled = Boolean(disabled);
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

  const button = (
    <button
      ref={ref}
      type="button"
      className={cn(iconButtonVariants({ variant, size }), className)}
      disabled={isDisabled}
      {...props}
    >
      <span className={glyphShellClass}>{children}</span>
    </button>
  );

  if (resolvedTitle) {
    return (
      <ControlHoverLabel label={resolvedTitle} disabled={isDisabled}>
        {button}
      </ControlHoverLabel>
    );
  }

  return button;
}

export default IconButton;
