import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  chrome,
  border as semanticBorders,
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const buttonTypographySizes = {
  xs: uiTypographyRecipes.label,
  sm: uiTypographyRecipes.captionStrong,
  md: uiTypographyRecipes.captionStrong,
  lg: uiTypographyRecipes.bodyStrong,
} as const;

const titleBarChromeExpandedTypography =
  'font-caption text-[0.875rem] font-semibold uppercase leading-none tracking-[0.14em]';

export const connectButtonRecipes = {
  base: [
    `inline-flex items-center gap-2 rounded-full px-5 py-2 ${uiTypographyRecipes.captionStrong} whitespace-nowrap`,
    'transition-all duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    'dark:focus-visible:ring-offset-slate-900',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none',
  ],
  secondary: [
    'border',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    semanticTextRecipes.muted,
    ...semanticEffects.glassShadow,
    'hover:border-[var(--color-border-hover-accent)] hover:text-[var(--color-text-primary)]',
    'dark:text-[#cbd5e1]',
    'dark:hover:border-[var(--color-border-hover-accent)] dark:hover:text-white',
  ],
} as const;

export const buttonRecipes = {
  base: [
    'inline-flex items-center justify-center gap-2',
    'uppercase',
    'transition-all duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-slate-900',
    'disabled:cursor-not-allowed disabled:opacity-60',
  ],
  primary: [
    'bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500',
    semanticTextRecipes.inverse,
    'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)]',
    'hover:-translate-y-0.5',
    'disabled:hover:translate-y-0',
  ],
  secondary: [
    'border',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    semanticTextRecipes.muted,
    ...semanticEffects.glassShadow,
    'hover:border-[var(--color-border-hover-accent)] hover:text-slate-900',
    'hover:shadow-[0_14px_32px_-18px_var(--color-effect-accent-hover)]',
    'dark:text-slate-300',
    'dark:hover:border-[var(--color-border-hover-accent)] dark:hover:text-white',
  ],
  ghost: [
    ...semanticBorders.glass,
    ...semanticSurfaces.glassPanel,
    semanticTextRecipes.primary,
    'hover:-translate-y-0.5',
    ...semanticEffects.glassShadow,
    'dark:text-slate-200',
  ],
  icon: [
    'border border-transparent',
    ...semanticSurfaces.mutedChip,
    semanticTextRecipes.muted,
    ...semanticEffects.glassShadow,
    'hover:-translate-y-[1px] hover:border-[var(--color-border-hover-accent)]',
    'hover:text-slate-900',
    'dark:text-slate-400',
    'dark:hover:border-[var(--color-border-hover-accent)] dark:hover:text-white',
  ],
  tab: [
    'group',
    'relative',
    'overflow-hidden',
    'border-transparent',
    'bg-transparent',
    'shadow-none',
  ],
  tabActive: [
    'group relative',
    'overflow-hidden',
    ...semanticBorders.glass,
    'bg-[linear-gradient(115deg,#38bdf8_0%,#22d3ee_46%,#a855f7_100%)]',
    'text-white',
    'shadow-[0_16px_42px_-18px_rgba(14,165,233,0.55)]',
    'backdrop-blur-sm',
    'before:absolute before:inset-0',
    'before:bg-[linear-gradient(140deg,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0)_60%)]',
    'before:opacity-80 before:pointer-events-none',
    'dark:border-[var(--color-border-glass)]',
    'dark:shadow-[0_16px_38px_-18px_rgba(56,189,248,0.55)]',
  ],
  danger: [
    ...semanticBorders.danger,
    ...semanticStatus.danger.surface,
    semanticTextRecipes.danger,
    'hover:bg-[var(--color-status-danger-strong-surface)]',
    'dark:hover:bg-[color:color-mix(in_srgb,var(--color-status-danger-strong-surface)_46%,transparent)]',
  ],
  success: [
    'bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400',
    semanticTextRecipes.inverse,
    'shadow-[0_20px_55px_-28px_rgba(16,185,129,0.65)]',
    'hover:-translate-y-[3px]',
    'disabled:hover:translate-y-0',
  ],
  connect: [
    'bg-gradient-to-r from-[#0ea5e9] via-[#38bdf8] to-[#a78bfa]',
    semanticTextRecipes.inverse,
    'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.78)]',
    'hover:-translate-y-[1px]',
    'hover:shadow-[0_28px_70px_-35px_rgba(14,165,233,0.85)]',
    'active:scale-[0.98]',
    'dark:shadow-[0_22px_60px_-32px_rgba(56,189,248,0.65)]',
  ],
} as const;

const buttonVariants = cva([...buttonRecipes.base], {
  variants: {
    variant: {
      primary: [...buttonRecipes.primary],
      secondary: [...buttonRecipes.secondary],
      ghost: [...buttonRecipes.ghost],
      icon: [...buttonRecipes.icon],
      tab: [...buttonRecipes.tab],
      tabActive: [...buttonRecipes.tabActive],
      danger: [...buttonRecipes.danger],
      success: [...buttonRecipes.success],
      connect: [...buttonRecipes.connect],
    },
    size: {
      xs: `${buttonTypographySizes.xs} ${chrome.xs}`,
      sm: `${buttonTypographySizes.sm} ${chrome.sm}`,
      titleBarExpanded: `${titleBarChromeExpandedTypography} ${chrome.sm}`,
      md: `${buttonTypographySizes.md} px-4 py-2 ${uiRadiusRecipes.standard}`,
      lg: `${buttonTypographySizes.lg} px-5 py-2.5 ${uiRadiusRecipes.standard}`,
      icon: `h-10 w-10 ${uiRadiusRecipes.standard}`,
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children?: React.ReactNode;
}

/**
 * Interactive button component with multiple visual styles.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg">Submit</Button>
 * <Button variant="secondary" size="md">Cancel</Button>
 * <Button variant="icon" size="icon"><CloseIcon /></Button>
 * ```
 *
 * @see {@link ../README.md} for detailed variant documentation
 */
export const Button = ({
  variant,
  size,
  loading,
  disabled,
  className,
  children,
  ref,
  ...props
}: ButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
};

Button.displayName = 'Button';

export default Button;
