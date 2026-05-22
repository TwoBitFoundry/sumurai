import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  buttonChrome,
  buttonCta,
  chrome,
  control,
  border as semanticBorders,
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  successCta,
  radius as uiRadiusRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const buttonTypographySizes = {
  sm: control.label.sm,
  md: control.label.md,
  lg: control.label.lg,
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
    ...buttonChrome.secondary,
    ...semanticSurfaces.card,
    semanticTextRecipes.muted,
    ...semanticEffects.glassShadow,
    'hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]',
    'dark:text-[#cbd5e1]',
    'dark:hover:border-[var(--color-border-default)] dark:hover:text-white',
  ],
} as const;

export const buttonRecipes = {
  base: [
    'inline-flex items-center justify-center gap-2',
    'cursor-pointer',
    'uppercase',
    'transition-all duration-200 ease-out',
    'active:scale-[0.98]',
    'disabled:active:scale-100',
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
    ...buttonChrome.secondary,
    ...semanticSurfaces.card,
    semanticTextRecipes.muted,
    ...semanticEffects.glassShadow,
    'hover:-translate-y-0.5',
    'hover:border-[var(--color-border-default)] hover:text-slate-900',
    'hover:shadow-[0_14px_32px_-18px_var(--color-effect-accent-hover)]',
    'disabled:hover:translate-y-0',
    'dark:text-slate-300',
    'dark:hover:border-[var(--color-border-default)] dark:hover:text-white',
  ],
  ghost: [
    ...buttonChrome.ghost,
    ...semanticSurfaces.glassPanel,
    semanticTextRecipes.primary,
    'hover:-translate-y-0.5',
    'hover:border-[var(--color-border-control)]',
    'dark:hover:border-[color:color-mix(in_srgb,var(--color-border-glass)_20%,transparent)]',
    ...semanticEffects.glassShadow,
    'dark:text-slate-200',
  ],
  icon: [
    ...buttonChrome.muted,
    ...semanticSurfaces.mutedChip,
    semanticTextRecipes.muted,
    ...semanticEffects.glassShadow,
    'hover:-translate-y-[1px] hover:border-[var(--color-border-default)]',
    'hover:text-slate-900',
    'dark:text-slate-400',
    'dark:hover:border-[var(--color-border-default)] dark:hover:text-white',
  ],
  filterChip: [
    'border',
    'border-transparent',
    'bg-transparent',
    'shadow-none',
    'backdrop-blur-sm',
    'hover:-translate-y-[2px]',
    'hover:shadow-lg',
    'disabled:hover:translate-y-0',
    'disabled:hover:shadow-none',
  ],
  tab: [
    'group',
    'relative',
    'overflow-hidden',
    'border-transparent',
    'bg-transparent',
    'shadow-none',
    'hover:-translate-y-0.5',
    'disabled:hover:translate-y-0',
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
    'border',
    ...semanticStatus.danger.border,
    ...semanticStatus.danger.surface,
    ...semanticStatus.danger.text,
    ...semanticEffects.glassShadow,
    'hover:-translate-y-0.5',
    'hover:bg-[var(--color-status-danger-strong-surface)]',
    'disabled:hover:translate-y-0',
    'dark:hover:bg-[color:color-mix(in_srgb,var(--color-status-danger-strong-surface)_46%,transparent)]',
  ],
  success: [
    ...successCta.gradient,
    semanticTextRecipes.inverse,
    ...semanticEffects.successGlow,
    ...successCta.hover,
    'disabled:hover:translate-y-0',
  ],
  connect: [
    ...buttonCta.gradient,
    semanticTextRecipes.inverse,
    ...buttonCta.shadow,
    ...buttonCta.hover,
  ],
} as const;

const buttonVariants = cva([...buttonRecipes.base], {
  variants: {
    variant: {
      primary: [...buttonRecipes.primary],
      secondary: [...buttonRecipes.secondary],
      ghost: [...buttonRecipes.ghost],
      icon: [...buttonRecipes.icon],
      filterChip: [...buttonRecipes.filterChip],
      tab: [...buttonRecipes.tab],
      tabActive: [...buttonRecipes.tabActive],
      danger: [...buttonRecipes.danger],
      success: [...buttonRecipes.success],
      connect: [...buttonRecipes.connect],
    },
    size: {
      sm: '',
      md: '',
      lg: '',
      inherit: '',
      titleBarExpanded: '',
    },
    shape: {
      default: '',
      square: '',
      pill: '',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
    shape: 'default',
  },
  compoundVariants: [
    {
      shape: 'default',
      size: 'sm',
      class: `${control.height.sm} ${control.paddingX.sm} ${control.label.sm} ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'default',
      size: 'md',
      class: `${control.height.md} ${control.paddingX.md} ${control.label.md} ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'default',
      size: 'lg',
      class: `${control.height.lg} ${control.paddingX.lg} ${control.label.lg} ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'default',
      size: 'titleBarExpanded',
      class: `${titleBarChromeExpandedTypography} ${chrome.sm}`,
    },
    {
      shape: 'square',
      size: 'sm',
      class: `${control.square.sm} p-0 ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'square',
      size: 'md',
      class: `${control.square.md} p-0 ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'square',
      size: 'lg',
      class: `${control.square.lg} p-0 ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'pill',
      size: 'sm',
      class: `max-w-full shrink-0 gap-1.5 rounded-full px-2.5 py-1 ${control.height.sm} ${uiTypographyRecipes.badge}`,
    },
    {
      shape: 'pill',
      size: 'md',
      class: `max-w-full shrink-0 gap-1.5 rounded-full px-3 py-1 ${control.height.md} ${uiTypographyRecipes.badge}`,
    },
  ],
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = ({
  variant,
  size,
  shape,
  loading,
  disabled,
  className,
  children,
  ref,
  ...props
}: ButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) => {
  const resolvedSize = size ?? 'md';
  const isSquare = shape === 'square';
  const glyphSize =
    resolvedSize === 'sm' || resolvedSize === 'md' || resolvedSize === 'lg' ? resolvedSize : 'md';

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, shape }), className)}
      {...props}
    >
      {isSquare ? (
        <span
          className={cn(
            'inline-flex',
            'shrink-0',
            'items-center',
            'justify-center',
            control.glyph[glyphSize],
            '[&_svg]:block',
            '[&_svg]:h-full',
            '[&_svg]:w-full'
          )}
        >
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
};

Button.displayName = 'Button';

export default Button;
